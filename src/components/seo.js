import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

// useStaticQuery has been removed from this component entirely.
// Calling useStaticQuery inside Gatsby 5's Head API export is broken for
// MDX-backed pages using gatsby-plugin-mdx v5's ?__contentFilePath= mechanism:
// those chunks fail to register the static query hash, causing a runtime crash.
//
// siteMetadata must always be passed as a prop sourced from the page GraphQL query.
const Seo = ({ type, title, description, slug, image, tags, siteMetadata }) => {
  const { name = '', siteUrl = '', defaultImage = '', keywords = [] } = siteMetadata || {};

  const htmlTitle = `${name} | ${title}`;
  const ogImage = image ? image : defaultImage;
  const seoKeywords = tags ? tags : keywords;

  return (
    <Fragment>
      <title>{htmlTitle}</title>
      <link rel="canonical" href={`${siteUrl}${slug}`} />
      <meta name="description" content={description} />
      <meta name="image" content={`${siteUrl}${ogImage}`} />
      <meta name="image:alt" content={description} />
      <meta name="keywords" content={Array.isArray(seoKeywords) ? seoKeywords.join(', ') : ''} />

      {/* Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={htmlTitle} />
      <meta property="og:url" content={`${siteUrl}${slug}`} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      <meta property="og:image:alt" content={description}></meta>

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={htmlTitle} />
      <meta name="twitter:url" content={`${siteUrl}${slug}`} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />
      <meta name="twitter:image:alt" content={description}></meta>
    </Fragment>
  );
};

Seo.propTypes = {
  type: PropTypes.oneOf(['website', 'article']),
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  slug: PropTypes.string.isRequired,
  image: PropTypes.string,
  tags: PropTypes.arrayOf(PropTypes.string),
  siteMetadata: PropTypes.shape({
    name: PropTypes.string,
    siteUrl: PropTypes.string,
    defaultImage: PropTypes.string,
    keywords: PropTypes.arrayOf(PropTypes.string)
  }).isRequired
};

Seo.defaultProps = {
  type: 'website'
};

export default Seo;
