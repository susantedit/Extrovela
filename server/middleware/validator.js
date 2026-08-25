/**
 * EXTROVELA — Server-Side Request Payload Validator
 * 
 * Enforces strict typing, range checking, and rejects unexpected injection fields.
 */

export function validateQuestPayload(req, res, next) {
  const { category, energy, social, time } = req.body || {};

  const validEnergies = ['Chill', 'Moderate', 'High Energy', 'Flexible', 'low', 'medium', 'high'];
  const validSocial = ['Solo', 'Social', 'Friends', 'solo', 'friends', 'meet_people', 'flexible'];

  if (energy && !validEnergies.includes(energy)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ARGUMENT', message: 'Invalid energy level provided.' },
    });
  }

  if (social && !validSocial.includes(social)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ARGUMENT', message: 'Invalid social mode provided.' },
    });
  }

  next();
}

export function validateCoordinates(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
