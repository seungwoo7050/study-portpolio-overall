package com.example.training.issue.service;

import com.example.training.common.exception.DuplicateResourceException;
import com.example.training.issue.domain.User;
import com.example.training.issue.dto.UserRegistrationRequest;
import com.example.training.issue.dto.UserResponse;
import com.example.training.issue.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserResponse registerUser(UserRegistrationRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Email already exists: " + request.getEmail());
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());
        User user = new User(request.getEmail(), hashedPassword, request.getNickname());
        User savedUser = userRepository.save(user);

        return UserResponse.from(savedUser);
    }
}
