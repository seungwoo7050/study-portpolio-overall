package com.sagaline.common.event;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class UserRegisteredEvent extends BaseEvent {
    private Long userId;
    private String email;
    private String fullName;

    public UserRegisteredEvent(Long userId, String email, String fullName) {
        super("UserRegistered", "user-service");
        this.userId = userId;
        this.email = email;
        this.fullName = fullName;
    }
}
