package com.gogreen.controlplane.api.rest.dto;

public class JobCancelRequest {
    private String reason;

    public JobCancelRequest() {
    }

    public JobCancelRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return (reason != null && !reason.isBlank()) ? reason : "User requested cancellation";
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
