const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { CreatorCardMessages } = require('@app/messages');
const CreatorCard = require('@app/repository/creator-card');
const serializeCreatorCard = require('./serialize-creator-card');
const generateSlug = require('./generate-slug');

const ALLOWED_SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
const ALLOWED_ACCESS_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const spec = `root {
  title string<trim|minLength:3|maxLength:100>
  description? string<trim|maxLength:500>
  slug? string<trim|lowercase|lengthBetween:5,50>
  creator_reference string<length:20>
  links[]? {
    title string<trim|minLength:1|maxLength:100>
    url string<trim|maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<trim|minLength:3|maxLength:100>
      description? string<trim|maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`;

const parsedSpec = validator.parse(spec);

/**
 * Checks if a string contains only allowed slug characters (letters, numbers, hyphens, underscores).
 * No regex — iterates character by character.
 *
 * @param {string} str - The string to validate
 * @returns {boolean} True if all characters are allowed
 */
function isValidSlugChars(str) {
  let i = 0;

  while (i < str.length) {
    if (ALLOWED_SLUG_CHARS.indexOf(str[i]) === -1) {
      return false;
    }
    i += 1;
  }

  return true;
}

/**
 * Checks if a string contains only alphanumeric characters.
 * No regex — iterates character by character.
 *
 * @param {string} str - The string to validate
 * @returns {boolean} True if all characters are alphanumeric
 */
function isAlphanumeric(str) {
  let i = 0;

  while (i < str.length) {
    if (ALLOWED_ACCESS_CODE_CHARS.indexOf(str[i]) === -1) {
      return false;
    }
    i += 1;
  }

  return true;
}

/**
 * Validates that a URL starts with http:// or https://.
 * No regex — uses startsWith.
 *
 * @param {string} url - The URL to validate
 * @returns {boolean} True if the URL starts with http:// or https://
 */
function isValidUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Validates that an amount is a positive integer (no decimals, no negatives, no zero).
 *
 * @param {number} amount - The amount to validate
 * @returns {boolean} True if the amount is a positive integer >= 1
 */
function isPositiveInteger(amount) {
  return Number.isInteger(amount) && amount >= 1;
}

/**
 * Creates a new creator card.
 *
 * @param {Object} serviceData - The card data from the request body
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Serialized creator card
 */
async function createCreatorCard(serviceData, options = {}) {
  let response;

  // Step 1: Validate input data via VSL
  const data = validator.validate(serviceData, parsedSpec);

  try {
    // Step 2: Validate links URLs (startsWith check not expressible in VSL)
    if (data.links && data.links.length > 0) {
      let linkIndex = 0;

      while (linkIndex < data.links.length) {
        const link = data.links[linkIndex];

        if (!isValidUrl(link.url)) {
          throwAppError('Link URL must start with http:// or https://', 'VALIDATION_ERROR');
        }
        linkIndex += 1;
      }
    }

    // Step 3: Validate service_rates amounts are positive integers
    if (data.service_rates && data.service_rates.rates) {
      let rateIndex = 0;

      while (rateIndex < data.service_rates.rates.length) {
        const rate = data.service_rates.rates[rateIndex];

        if (!isPositiveInteger(rate.amount)) {
          throwAppError('Rate amount must be a positive integer (no decimals)', 'VALIDATION_ERROR');
        }
        rateIndex += 1;
      }
    }

    // Step 4: Validate slug characters if client-supplied
    if (data.slug && !isValidSlugChars(data.slug)) {
      throwAppError(
        'Slug can only contain letters, numbers, hyphens, and underscores',
        'VALIDATION_ERROR'
      );
    }

    // Step 5: Validate access_code is alphanumeric if provided
    if (data.access_code && !isAlphanumeric(data.access_code)) {
      throwAppError('Access code must contain only alphanumeric characters', 'VALIDATION_ERROR');
    }

    // Step 6: Business rule — access_type=private with no access_code → AC01
    const accessType = data.access_type || 'public';

    if (accessType === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, 'AC01');
    }

    // Step 7: Business rule — access_code present but access_type is public or omitted → AC05
    if (data.access_code && accessType !== 'private') {
      throwAppError(CreatorCardMessages.ACCESS_CODE_NOT_ALLOWED, 'AC05');
    }

    // Step 8: Handle slug — auto-generate or check uniqueness
    let slug;

    if (data.slug) {
      // Client-supplied slug: check uniqueness
      const existingCard = await CreatorCard.findOne({ query: { slug: data.slug } });

      if (existingCard) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, 'SL02');
      }
      slug = data.slug;
    } else {
      // Auto-generate slug from title
      slug = await generateSlug(data.title);
    }

    // Step 9: Build card document
    const cardData = {
      title: data.title,
      description: data.description || null,
      slug,
      creator_reference: data.creator_reference,
      links: data.links || [],
      service_rates: data.service_rates || null,
      status: data.status,
      access_type: accessType,
      access_code: accessType === 'private' ? data.access_code : undefined,
    };

    // Step 10: Persist to MongoDB (repository auto-generates _id, created, updated)
    const createdCard = await CreatorCard.create(cardData);

    // Step 11: Serialize response
    response = serializeCreatorCard(createdCard, { includeAccessCode: true });
  } catch (error) {
    appLogger.error({ error: error.message }, 'create-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = createCreatorCard;
