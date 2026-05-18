use aws_sdk_scheduler::types::{
    ActionAfterCompletion, FlexibleTimeWindow, FlexibleTimeWindowMode, Target,
};
use aws_sdk_scheduler::Client;
use chrono::{DateTime, Utc};

use crate::error::AppError;

pub struct SchedulerConfig {
    pub client: Client,
    pub group_name: String,
    pub worker_arn: String,
    pub invoke_role_arn: String,
}

/// Create a one-shot schedule that invokes the worker Lambda with the
/// proposal id at `fire_at`. Schedule name encodes the proposal id so
/// re-creation is idempotent. Returns the schedule's ARN.
pub async fn schedule_close(
    cfg: &SchedulerConfig,
    proposal_id: &str,
    fire_at: DateTime<Utc>,
) -> Result<String, AppError> {
    let name = format!("close-{proposal_id}");
    let payload = serde_json::json!({ "proposal_id": proposal_id }).to_string();

    let target = Target::builder()
        .arn(&cfg.worker_arn)
        .role_arn(&cfg.invoke_role_arn)
        .input(payload)
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    // Scheduler accepts `at()` expressions in UTC; format must be
    // YYYY-MM-DDTHH:MM:SS (no fractional seconds, no offset suffix).
    let expr = format!("at({})", fire_at.format("%Y-%m-%dT%H:%M:%S"));

    // CreateSchedule fails with `ConflictException` if a schedule with the same
    // (group, name) exists; we'd hit that on re-create. Try CreateSchedule
    // first; if conflict, switch to UpdateSchedule.
    let create = cfg
        .client
        .create_schedule()
        .name(&name)
        .group_name(&cfg.group_name)
        .schedule_expression(&expr)
        .schedule_expression_timezone("UTC")
        .flexible_time_window(
            FlexibleTimeWindow::builder()
                .mode(FlexibleTimeWindowMode::Off)
                .build()
                .map_err(|e| AppError::Internal(Box::new(e)))?,
        )
        .target(target.clone())
        .action_after_completion(ActionAfterCompletion::Delete)
        .send()
        .await;

    match create {
        Ok(r) => Ok(r.schedule_arn),
        Err(err) => {
            let svc = err.into_service_error();
            if matches!(
                svc,
                aws_sdk_scheduler::operation::create_schedule::CreateScheduleError::ConflictException(_)
            ) {
                cfg.client
                    .update_schedule()
                    .name(&name)
                    .group_name(&cfg.group_name)
                    .schedule_expression(&expr)
                    .schedule_expression_timezone("UTC")
                    .flexible_time_window(
                        FlexibleTimeWindow::builder()
                            .mode(FlexibleTimeWindowMode::Off)
                            .build()
                            .map_err(|e| AppError::Internal(Box::new(e)))?,
                    )
                    .target(target)
                    .action_after_completion(ActionAfterCompletion::Delete)
                    .send()
                    .await
                    .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;
                // Compose the ARN manually — UpdateSchedule doesn't return it.
                Ok(format!(
                    "arn:aws:scheduler:eu-west-1:_:schedule/{}/{}",
                    cfg.group_name, name
                ))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

/// Delete the close schedule for a proposal. No-op if the schedule has already
/// fired and been deleted (Scheduler returns ResourceNotFoundException).
pub async fn cancel_close(cfg: &SchedulerConfig, proposal_id: &str) -> Result<(), AppError> {
    let name = format!("close-{proposal_id}");
    let result = cfg
        .client
        .delete_schedule()
        .name(&name)
        .group_name(&cfg.group_name)
        .send()
        .await;
    match result {
        Ok(_) => Ok(()),
        Err(err) => {
            let svc = err.into_service_error();
            if matches!(
                svc,
                aws_sdk_scheduler::operation::delete_schedule::DeleteScheduleError::ResourceNotFoundException(_)
            ) {
                Ok(())
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}
