package com.example.planning;

import com.example.planning.service.CommandLineSolveRunner;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class PlanningSolverApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlanningSolverApplication.class, args);
    }

    @Bean
    CommandLineRunner commandLineRunner(CommandLineSolveRunner runner) {
        return runner;
    }
}
