CREATE DATABASE IF NOT EXISTS event_system;
USE event_system;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    user_id    INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100)  NOT NULL,
    email      VARCHAR(100)  UNIQUE NOT NULL,
    password   VARCHAR(255)  NOT NULL,
    role       ENUM('user','organizer') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EVENTS (with soft-delete + category/capacity)
CREATE TABLE IF NOT EXISTS events (
    event_id     INT AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(255)   NOT NULL,
    description  TEXT,
    event_date   DATE           NOT NULL,
    location     VARCHAR(255)   NOT NULL,
    price        DECIMAL(10,2)  DEFAULT 0,
    category     VARCHAR(100)   DEFAULT 'Other',
    capacity     INT            DEFAULT NULL,
    organizer_id INT            NOT NULL,
    is_deleted   TINYINT(1)     DEFAULT 0,
    created_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(user_id)
);

-- REGISTRATIONS (payment_status added; CASCADE DELETE)
CREATE TABLE IF NOT EXISTS registrations (
    reg_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT  NOT NULL,
    event_id       INT  NOT NULL,
    payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING',
    reg_date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_event (user_id, event_id),
    FOREIGN KEY (user_id)  REFERENCES users(user_id),
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- PAYMENTS (CASCADE DELETE)
CREATE TABLE IF NOT EXISTS payments (
    payment_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT           NOT NULL,
    event_id            INT           NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    status              ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
    payment_date        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    razorpay_order_id   VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    FOREIGN KEY (user_id)  REFERENCES users(user_id),
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────
-- MIGRATION (run if upgrading an EXISTING database)
-- ─────────────────────────────────────────────
-- ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_status ENUM('PENDING','PAID','FAILED') DEFAULT 'PENDING';
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) DEFAULT 0;
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Other';
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INT DEFAULT NULL;
