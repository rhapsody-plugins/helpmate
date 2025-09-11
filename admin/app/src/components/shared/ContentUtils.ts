// Function to detect if content is dynamic (mostly HTML comments and empty divs)
export const isDynamicContent = (content: string): boolean => {
  if (!content) return true;

  // Split content by "Metadata:" to get only the post content
  const contentParts = content.split('\n\nMetadata:');
  const postContent = contentParts[0];

  // Remove HTML comments
  const withoutComments = postContent.replace(/<!--[\s\S]*?-->/g, '');

  // Remove empty divs and whitespace
  const withoutEmptyDivs = withoutComments.replace(/<div[^>]*>\s*<\/div>/g, '');

  // Remove all HTML tags
  const withoutTags = withoutEmptyDivs.replace(/<[^>]*>/g, '');

  // Remove extra whitespace and check if there's meaningful text
  const cleanText = withoutTags.replace(/\s+/g, ' ').trim();

  // If less than 50 characters of meaningful text, consider it dynamic
  return cleanText.length < 50;
};

// Function to get dynamic content explanation
export const getDynamicContentExplanation = (content: string): string => {
  if (!content) return 'No content available';

  // Split content by "Metadata:" to get only the post content
  const contentParts = content.split('\n\nMetadata:');
  const postContent = contentParts[0];

  const withoutComments = postContent.replace(/<!--[\s\S]*?-->/g, '');
  const withoutEmptyDivs = withoutComments.replace(/<div[^>]*>\s*<\/div>/g, '');
  const withoutTags = withoutEmptyDivs.replace(/<[^>]*>/g, '');
  const cleanText = withoutTags.replace(/\s+/g, ' ').trim();

  if (cleanText.length === 0) {
    return 'This content consists entirely of HTML comments and empty divs, which is typical for dynamic content that gets populated by JavaScript or server-side rendering. Add content to description for better training.';
  }

  return `This content has minimal text content (${cleanText.length} characters) and consists mostly of HTML structure, comments, and empty containers. This is typical for dynamic content that gets populated by JavaScript, server-side rendering, or external data sources. Add more content to description for better training.`;
};
