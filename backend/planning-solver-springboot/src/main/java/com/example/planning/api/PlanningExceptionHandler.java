package com.example.planning.api;

import com.example.planning.dto.ApiError;
import com.example.planning.io.PlanningRequestException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class PlanningExceptionHandler {
    @ExceptionHandler(PlanningRequestException.class)
    public ResponseEntity<ApiError> handlePlanningRequest(PlanningRequestException ex) {
        return ResponseEntity.badRequest().body(new ApiError("PLANNING_REQUEST_ERROR", ex.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        HttpStatus resolved = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
        return ResponseEntity.status(resolved)
                .body(new ApiError("HTTP_ERROR", ex.getReason() == null ? "Request error" : ex.getReason()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleOther(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("INTERNAL_ERROR", ex.getMessage()));
    }
}
