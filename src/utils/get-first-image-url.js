const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/i;
const HTML_IMAGE_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
const PREVIEWABLE_URL_REGEX = /^(https?:\/\/|\/)/i;

const unwrapUrl = (url) => {
  if (!url) {
    return null;
  }

  return url.replace(/^<|>$/g, '');
};

const toPreviewableUrl = (url) => {
  const unwrapped = unwrapUrl(url);
  if (!unwrapped || !PREVIEWABLE_URL_REGEX.test(unwrapped)) {
    return null;
  }

  return unwrapped;
};

const getFirstImageUrl = (content) => {
  if (!content) {
    return null;
  }

  const markdownMatch = content.match(MARKDOWN_IMAGE_REGEX);
  if (markdownMatch?.[1]) {
    return toPreviewableUrl(markdownMatch[1]);
  }

  const htmlMatch = content.match(HTML_IMAGE_REGEX);
  if (htmlMatch?.[1]) {
    return toPreviewableUrl(htmlMatch[1]);
  }

  return null;
};

export default getFirstImageUrl;
