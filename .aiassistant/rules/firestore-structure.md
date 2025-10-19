---
apply: always
---

# Firestore Database Structure

## Collections Overview

This project uses Firebase Firestore with the following collection structure:

### 1. `assessments` Collection
**Purpose:** Stores assessment/quiz information for students

**Document Structure:**
- **age**: string (e.g., "645")
- **createdAt**: timestamp (e.g., "2 October 2025 at 11:48:55 UTC+1")
- **grade**: string (e.g. "F5")
- **name**: string (Chinese text, e.g., "陳大文")
- **school**: string (Chinese text, e.g., "聖士提反女子中學")

**Document IDs:** Auto-generated alphanumeric strings (e.g., "6QesPVxJ6QK7Vw8iMgm4")

**Example Path:** `/assessments/{assessmentId}`

### 2. `answers` Collection
**Purpose:** Stores student answers for assessment questions

**Document Structure:**

- **type**: string ("mc" or "audio" ONLY) - question type ("multiple choice")
- **assessment-id**: string (e.g., "0") - references the associated assessment
- **createdAt**: timestamp (e.g., "2 October 2025 at 06:18:01 UTC+1")
- **section**: number (e.g., 0) - indicates the section/part of the assessment

If **type** is "mc", the document would include the following:
- **answers**: map with numeric keys and values (e.g., {0: 2, 1: 0, 2: 3, 3: 0, 4...}) - represents question index to selected answer mapping
Otherwise, **type** is "audio" and the document would include the following:
- **file**: string (e.g., "assessments/g4mseZg33YULLRRKmDw8/1.wav") - the storage path in Firebase cloud storage to the student's recorded audio answer

**Document IDs:** Auto-generated alphanumeric strings (e.g., "g4mseZg33YULLRRKmDw8")

**Example Path:** `/answers/{answerId}`

## Database Rules

### Relationships
- `answers.assessment-id` references `assessments` document ID
- Answers are stored separately from assessments (denormalized structure)
