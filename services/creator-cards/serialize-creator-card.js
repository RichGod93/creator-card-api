/**
 * Serializes a creator card document for API responses.
 * Maps _id to id, converts deleted:0 to deleted:null.
 *
 * @param {Object} card - Raw card document from MongoDB
 * @param {Object} options - Serialization options
 * @param {boolean} [options.includeAccessCode=true] - Whether to include access_code in response
 * @returns {Object} Serialized card object
 */
function serializeCreatorCard(card, options = {}) {
  const { includeAccessCode = true } = options;

  const serialized = {
    id: card._id,
    title: card.title,
    description: card.description || null,
    slug: card.slug,
    creator_reference: card.creator_reference,
    links: card.links || [],
    service_rates: card.service_rates || null,
    status: card.status,
    access_type: card.access_type || 'public',
    created: card.created,
    updated: card.updated,
    deleted: card.deleted === 0 ? null : card.deleted,
  };

  if (includeAccessCode) {
    serialized.access_code = card.access_code || null;
  }

  return serialized;
}

module.exports = serializeCreatorCard;
