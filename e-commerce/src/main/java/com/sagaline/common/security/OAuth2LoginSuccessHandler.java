package com.sagaline.common.security;

import com.sagaline.user.domain.User;
import com.sagaline.user.domain.UserRole;
import com.sagaline.user.domain.UserRoleEntity;
import com.sagaline.user.repository.UserRepository;
import com.sagaline.user.service.RefreshTokenService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Success handler for OAuth2 authentication (Kakao)
 * Creates or updates user and generates JWT tokens
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                       Authentication authentication) throws IOException, ServletException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        // Extract user info from Kakao
        Map<String, Object> attributes = oAuth2User.getAttributes();
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");

        String email = (String) kakaoAccount.get("email");
        String nickname = (String) profile.get("nickname");

        log.info("OAuth2 login success for email: {}", email);

        // Find or create user
        User user = userRepository.findByEmail(email)
                .orElseGet(() -> createUser(email, nickname));

        // Generate tokens
        Set<UserRole> roles = user.getRoles().stream()
                .map(UserRoleEntity::getRole)
                .collect(Collectors.toSet());

        String accessToken = jwtTokenProvider.createToken(user.getEmail(), user.getId(), roles);
        String refreshToken = refreshTokenService.createRefreshToken(user).getToken();

        // Redirect to frontend with tokens
        String redirectUrl = String.format("/oauth2/redirect?access_token=%s&refresh_token=%s",
                accessToken, refreshToken);

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    private User createUser(String email, String nickname) {
        log.info("Creating new user from OAuth2: {}", email);

        User user = User.builder()
                .email(email)
                .name(nickname)
                .passwordHash("") // No password for OAuth users
                .isActive(true)
                .isEmailVerified(true) // Email verified by Kakao
                .build();

        user = userRepository.save(user);

        // Add default role
        UserRoleEntity roleEntity = UserRoleEntity.builder()
                .user(user)
                .role(UserRole.ROLE_USER)
                .build();

        user.getRoles().add(roleEntity);
        return userRepository.save(user);
    }
}
