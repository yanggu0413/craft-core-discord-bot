// Unit-like test for daily check-in streak logic

function getCheckinResult(lastCheckin, checkinStreak, todayStr, yesterdayStr) {
  let newStreak = (lastCheckin === yesterdayStr) ? (checkinStreak + 1) : 1;
  let keysAwarded = 1;
  if (newStreak === 7) {
    keysAwarded = 3;
  } else if (newStreak > 7) {
    newStreak = 1;
    keysAwarded = 1;
  }
  return { newStreak, keysAwarded };
}

describe('Checkin Streak Logic Unit Tests', () => {
  const todayStr = '2026-07-14';
  const yesterdayStr = '2026-07-13';
  const twoDaysAgoStr = '2026-07-12';

  test('Consecutive check-in: streak 0 -> 1', () => {
    const res = getCheckinResult(yesterdayStr, 0, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(1);
    expect(res.keysAwarded).toBe(1);
  });

  test('Consecutive check-in: streak 1 -> 2', () => {
    const res = getCheckinResult(yesterdayStr, 1, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(2);
    expect(res.keysAwarded).toBe(1);
  });

  test('Consecutive check-in: streak 5 -> 6', () => {
    const res = getCheckinResult(yesterdayStr, 5, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(6);
    expect(res.keysAwarded).toBe(1);
  });

  test('Consecutive check-in: streak 6 -> 7 (hits 7, awards 3 keys)', () => {
    const res = getCheckinResult(yesterdayStr, 6, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(7);
    expect(res.keysAwarded).toBe(3);
  });

  test('Consecutive check-in: streak 7 -> 1 (resets on day 8, awards 1 key)', () => {
    const res = getCheckinResult(yesterdayStr, 7, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(1);
    expect(res.keysAwarded).toBe(1);
  });

  test('Consecutive check-in: streak 8 -> 1 (resets on day 8+, awards 1 key)', () => {
    const res = getCheckinResult(yesterdayStr, 8, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(1);
    expect(res.keysAwarded).toBe(1);
  });

  test('Broken check-in streak: last checkin was 2 days ago, streak was 6', () => {
    const res = getCheckinResult(twoDaysAgoStr, 6, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(1);
    expect(res.keysAwarded).toBe(1);
  });

  test('Broken check-in streak: last checkin was 2 days ago, streak was 7', () => {
    const res = getCheckinResult(twoDaysAgoStr, 7, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(1);
    expect(res.keysAwarded).toBe(1);
  });

  test('Fresh check-in (no previous checkin): last checkin null, streak 0', () => {
    const res = getCheckinResult(null, 0, todayStr, yesterdayStr);
    expect(res.newStreak).toBe(1);
    expect(res.keysAwarded).toBe(1);
  });
});
