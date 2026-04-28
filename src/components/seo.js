import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

// useStaticQuery has been removed from this component entirely.
// Calling useStaticQuery inside Gatsby 5's Head API export is broken for
// MDX-backed pages using gatsby-plugin-mdx v5's ?__contentFilePath= mechanism:
// those chunks fail to register the static query hash, causing a runtime crash.
//
// siteMetadata must always be passed as a prop sourced from the page GraphQL query.
const toAbsoluteUrl = (siteUrl, path) => {
  if (!path) {
    return siteUrl;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedSiteUrl = siteUrl?.replace(/\/+$/, '') ?? '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedSiteUrl}${normalizedPath}`;
};

const Seo = ({ type, title, description, slug, image, tags, siteMetadata, noindex }) => {
  const { name = '', siteUrl = '', defaultImage = '', keywords = [] } = siteMetadata || {};

  const pageUrl = toAbsoluteUrl(siteUrl, slug);
  const imageUrl = toAbsoluteUrl(siteUrl, image || defaultImage);
  const htmlTitle = `${name} | ${title}`;
  const ogType = type === 'article' || type === 'ctf' ? 'article' : 'website';
  const seoKeywords = tags ? tags : keywords;
  const robotsContent = noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  return (
    <Fragment>
      <title>{htmlTitle}</title>
      <link rel="canonical" href={pageUrl} />
      <meta name="description" content={description} />
      <meta name="image" content={imageUrl} />
      <meta name="image:alt" content={description} />
      <meta name="keywords" content={Array.isArray(seoKeywords) ? seoKeywords.join(', ') : ''} />
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      <meta name="bingbot" content={robotsContent} />

      {/* Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={name} />
      <meta property="og:title" content={htmlTitle} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={description}></meta>

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={htmlTitle} />
      <meta name="twitter:url" content={pageUrl} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={description}></meta>
    </Fragment>
  );
};

Seo.propTypes = {
  type: PropTypes.oneOf(['website', 'article', 'ctf']),
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
  image: PropTypes.string,
  tags: PropTypes.arrayOf(PropTypes.string),
  noindex: PropTypes.bool,
  siteMetadata: PropTypes.shape({
    name: PropTypes.string,
    siteUrl: PropTypes.string,
    defaultImage: PropTypes.string,
    keywords: PropTypes.arrayOf(PropTypes.string)
  }).isRequired
};

Seo.defaultProps = {
  type: 'website',
  noindex: false
};

export default Seo;
