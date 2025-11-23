package com.example.training.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateTeamRequest {

    @NotBlank(message = "Team name is required")
    @Size(min = 1, max = 100, message = "Team name must be between 1 and 100 characters")
    private String name;

    public CreateTeamRequest() {
    }

    public CreateTeamRequest(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
