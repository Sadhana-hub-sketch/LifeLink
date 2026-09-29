# Entity-Relationship (ER) Diagram - LifeLink Blood Donor Finder

The database consists of **3 MongoDB collections** (`donors`, `requests`, `donations`) containing **4 logical entities**, as `ACCEPTANCE` is an embedded document array (`acceptedBy`) within `REQUEST`.

```mermaid
erDiagram
    DONOR ||--o{ DONATION : makes
    REQUEST ||--o{ DONATION : "fulfilled by"
    DONOR ||--o{ ACCEPTANCE : gives
    REQUEST ||--o{ ACCEPTANCE : receives
    DONOR {
        ObjectId _id PK
        string name
        string gender
        string bloodGroup
        string phone
        string city
        GeoJSON location
        date lastDonationDate
        date nextEligibleDate
        boolean available
    }
    REQUEST {
        ObjectId _id PK
        string patientName
        string bloodGroup
        string city
        GeoJSON location
        int units
        string urgency
        string status
        date expiresAt
    }
    DONATION {
        ObjectId _id PK
        ObjectId donorId FK
        ObjectId requestId FK
        date donatedAt
        int units
    }
    ACCEPTANCE {
        ObjectId donorId FK
        date acceptedAt
        boolean donated
    }
```

> **Note:** `ACCEPTANCE` is **embedded** as an array `acceptedBy` inside the `REQUEST` document.
