const { randomNumbers } = require('@app-core/randomness');
const CreatorCard = require('@app/repository/creator-card');

const ALLOWED_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
const SUFFIX_CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Filters a string to only contain allowed slug characters (letters, numbers, hyphens, underscores).
 * Uses character-by-character iteration instead of regex.
 *
 * @param {string} input - The string to filter
 * @returns {string} Filtered string
 */
function filterAllowedChars(input) {
  let result = '';
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    if (ALLOWED_CHARS.indexOf(char) !== -1) {
      result += char;
    }
    i += 1;
  }

  return result;
}

/**
 * Generates a random 6-character alphanumeric suffix using randomNumbers.
 *
 * @returns {string} 6-character alphanumeric string
 */
function generateRandomSuffix() {
  let suffix = '';
  let i = 0;

  while (i < 6) {
    const index = randomNumbers(0, SUFFIX_CHARSET.length);
    suffix += SUFFIX_CHARSET[index];
    i += 1;
  }

  return suffix;
}

/**
 * Generates a slug from a title following the auto-generation rules:
 * 1. Lowercase the title
 * 2. Replace whitespace with hyphens
 * 3. Strip characters that aren't letters, numbers, hyphens, or underscores
 * 4. If result < 5 chars OR already taken, append "-" + random 6-char alphanumeric suffix
 *
 * No regex is used — only string manipulation methods.
 *
 * @param {string} title - The card title to generate a slug from
 * @returns {Promise<string>} Generated unique slug
 */
async function generateSlug(title) {
  // Step 1: Lowercase the title
  const lowered = title.toLowerCase();

  // Step 2: Replace whitespace with hyphens (split on space, join with hyphen)
  const parts = lowered.split(' ');
  const hyphenated = parts.join('-');

  // Step 3: Filter to only allowed characters (no regex)
  const filtered = filterAllowedChars(hyphenated);

  // Step 4: Check length and uniqueness
  let slug = filtered;
  if (slug.length < 5) {
    slug = `${slug}-${generateRandomSuffix()}`;
  } else {
    // Check if slug is taken
    const existingCard = await CreatorCard.findOne({ query: { slug } });
    if (existingCard) {
      slug = `${slug}-${generateRandomSuffix()}`;
    }
  }

  return slug;
}

module.exports = generateSlug;
