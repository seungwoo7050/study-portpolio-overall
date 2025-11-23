package com.sagaline.common.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;
import org.jasypt.encryption.StringEncryptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * JPA Attribute Converter for encrypting/decrypting PII (Personally Identifiable Information)
 * at the database layer. This ensures sensitive data like phone numbers and addresses
 * are encrypted at rest.
 */
@Slf4j
@Converter
@Component
public class PiiEncryptionConverter implements AttributeConverter<String, String> {

    private static StringEncryptor encryptor;

    @Autowired
    public void setEncryptor(StringEncryptor encryptor) {
        PiiEncryptionConverter.encryptor = encryptor;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return attribute;
        }

        try {
            String encrypted = encryptor.encrypt(attribute);
            log.debug("PII data encrypted for storage");
            return encrypted;
        } catch (Exception e) {
            log.error("Failed to encrypt PII data", e);
            throw new RuntimeException("Encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return dbData;
        }

        try {
            String decrypted = encryptor.decrypt(dbData);
            log.debug("PII data decrypted from storage");
            return decrypted;
        } catch (Exception e) {
            log.error("Failed to decrypt PII data", e);
            // Return null or throw exception based on requirements
            return null;
        }
    }
}
