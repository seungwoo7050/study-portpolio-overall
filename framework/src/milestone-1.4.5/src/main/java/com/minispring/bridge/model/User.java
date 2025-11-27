package com.minispring.bridge.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User domain model matching mini-spring's User dataclass.
 *
 * <p>Corresponds to the Python User dataclass in milestone-1.4/database.py:
 * <pre>
 * {@code
 * @dataclass(slots=True)
 * class User:
 *     id: str
 *     name: str
 *     email: str
 * }
 * </pre>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private String id;
    private String name;
    private String email;
}
