const db = require('../src/database');

describe('Warp Submissions CRUD Operations', () => {
  beforeAll(async () => {
    await db.init(':memory:');
  });

  afterAll(async () => {
    await db.close();
  });

  test('should create, read, update, and list warp submissions', async () => {
    // 1. Create submission
    const result = await db.createWarpSubmission(
      'TestUser',
      '123456789012345678',
      'Iron Farm',
      'Automatic iron golem farm',
      '100, 64, -200',
      'overworld'
    );
    expect(result).toBeDefined();
    const submissionId = Number(result.lastInsertRowid);
    expect(submissionId).toBeGreaterThan(0);

    // 2. Read submission by ID
    const submission = await db.getWarpSubmissionById(submissionId);
    expect(submission).toBeDefined();
    expect(submission.id).toBe(submissionId);
    expect(submission.applicant_username).toBe('TestUser');
    expect(submission.applicant_discord_id).toBe('123456789012345678');
    expect(submission.facility_name).toBe('Iron Farm');
    expect(submission.function_desc).toBe('Automatic iron golem farm');
    expect(submission.coords).toBe('100, 64, -200');
    expect(submission.dimension).toBe('overworld');
    expect(submission.status).toBe('pending');
    expect(submission.admin_reviewer).toBeNull();

    // 3. Get pending submissions
    const pendingList = await db.getPendingWarpSubmissions();
    expect(pendingList).toBeDefined();
    expect(pendingList.length).toBe(1);
    expect(pendingList[0].id).toBe(submissionId);

    // 4. Create a second submission
    const result2 = await db.createWarpSubmission(
      'UserTwo',
      '987654321098765432',
      'Gold Farm',
      'Piglin gold farm',
      '0, 120, 0',
      'nether'
    );
    const submissionId2 = Number(result2.lastInsertRowid);

    const pendingList2 = await db.getPendingWarpSubmissions();
    expect(pendingList2.length).toBe(2);

    // 5. Update submission status (Approve first submission)
    await db.updateWarpSubmissionStatus(submissionId, 'approved', 'AdminUser');
    const updatedSubmission = await db.getWarpSubmissionById(submissionId);
    expect(updatedSubmission.status).toBe('approved');
    expect(updatedSubmission.admin_reviewer).toBe('AdminUser');

    // 6. Verify pending submissions only contains the second submission
    const pendingListAfterApprove = await db.getPendingWarpSubmissions();
    expect(pendingListAfterApprove.length).toBe(1);
    expect(pendingListAfterApprove[0].id).toBe(submissionId2);

    // 7. Reject second submission
    await db.updateWarpSubmissionStatus(submissionId2, 'rejected', 'AdminUser2');
    const updatedSubmission2 = await db.getWarpSubmissionById(submissionId2);
    expect(updatedSubmission2.status).toBe('rejected');
    expect(updatedSubmission2.admin_reviewer).toBe('AdminUser2');

    // 8. Pending submissions should now be empty
    const pendingListFinal = await db.getPendingWarpSubmissions();
    expect(pendingListFinal.length).toBe(0);

    // 9. Get all warp submissions
    const allSubmissions = await db.getAllWarpSubmissions();
    expect(allSubmissions.length).toBe(2);
  });
});
