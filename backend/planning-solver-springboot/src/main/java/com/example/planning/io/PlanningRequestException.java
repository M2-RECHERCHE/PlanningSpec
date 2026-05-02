package com.example.planning.io;

public class PlanningRequestException extends RuntimeException {
    public PlanningRequestException(String message) {
        super(message);
    }

    public PlanningRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
