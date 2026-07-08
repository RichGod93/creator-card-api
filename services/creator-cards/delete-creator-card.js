const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');

const spec = `root {
  slug string<trim>
  creator_reference string<length:20>
}`;

const parsedSpec = validator.parse(spec);

/**
 * Soft-deletes a creator card by slug.
 * Sets `deleted` to current epoch ms.
 * After this, GET on that slug returns 404 NF01.
 *
 * @param {Object} serviceData - Contains slug (from path) and creator_reference (from body)
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Full serialized card with access_code included and deleted timestamp set
 */
async function deleteCreatorCard(serviceData, options = {}) {
  let response;

  // Step 1: Validate input
  const data = validator.validate(serviceData, parsedSpec);

  try {
    // Step 2: Find card by slug (paranoid mode auto-filters deleted records)
    const card = await CreatorCard.findOne({ query: { slug: data.slug } });

    // If no card found → NF01
    if (!card) {
      throwAppError(CreatorCardMessages.CARD_NOT_FOUND, 'NF01');
    }

    // Step 3: Soft-delete using the repository's deleteOne (which mutates unique fields
    // like slug to free them in the unique index — e.g. slug becomes "&del:{ts}-slug")
    const now = Date.now();

    await CreatorCard.deleteOne({
      query: { _id: card._id },
    });

    // Step 4: Return full card with deleted timestamp set
    card.deleted = now;
    card.updated = now;

    response = serializeCreatorCard(card, { includeAccessCode: true });
  } catch (error) {
    appLogger.error({ error: error.message }, 'delete-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = deleteCreatorCard;
