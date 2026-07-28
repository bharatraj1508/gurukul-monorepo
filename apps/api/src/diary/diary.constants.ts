/**
 * Write-payload bounds for diary notes.
 * Shared by the create and update DTOs so the two can never drift apart.
 */
export const DIARY_NOTE_MAX_LENGTH = 5000;

/**
 * Caps the target-student list, which also bounds the enrolment `IN` query in
 * `assertStudentsEnrolled`. Well above any real class roster — the form options
 * endpoint only ever surfaces a single class's active enrolments.
 */
export const DIARY_STUDENT_IDS_MAX_SIZE = 200;
