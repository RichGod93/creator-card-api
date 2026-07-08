const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');

const spec = `root {
  slug string<trim>
  access_code? string<trim>
}`;

const parsedSpec = validator.parse(spec);

/**
 * Retrieves a creator card by slug with access control.
 * Access rules (in order):
 * 1. No card with that slug → 404 NF01
 * 2. Card status=draft → 404 NF02
 * 3. Card is private and no access_code query param → 403 AC03
 * 4. Card is private and access_code doesn't match → 403 AC04
 * 5. Otherwise → 200 with serialized card (access_code omitted)
 *
 * Soft-deleted cards behave as if they don't exist (→ NF01).
 *
 * @param {Object} serviceData - Contains slug and optional access_code
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Serialized creator card without access_code
 */
async function getCreatorCard(serviceData, options = {}) {
  let response;

  // Step 1: Validate input
  const data = validator.validate(serviceData, parsedSpec);

  try {
    // Step 2: Find card by slug (paranoid mode auto-filters deleted records)
    const card = await CreatorCard.findOne({ query: { slug: data.slug } });

    // Rule 1: No card found → NF01
    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    // Rule 2: Card is draft → NF02
    if (card.status === 'draft') {
      throwAppError(CreatorCardMessages.CARD_IS_DRAFT, 'NF02');
    }

    // Rule 3: Card is private and no access_code → AC03
    const cardAccessType = card.access_type || 'public';

    if (cardAccessType === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_MISSING, 'AC03');
    }

    // Rule 4: Card is private and access_code doesn't match → AC04
    if (cardAccessType === 'private' && data.access_code !== card.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_INVALID, 'AC04');
    }

    // Rule 5: Success — serialize without access_code
    response = serializeCreatorCard(card, { includeAccessCode: false });
  } catch (error) {
    appLogger.error({ error: error.message }, 'get-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = getCreatorCard;
