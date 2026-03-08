import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { useStaticQuery, graphql } from 'gatsby';

// siteMetadata can be provided two ways:
//
//   1. As a `siteMetadata` prop (preferred for MDX-backed pages using Gatsby 5's
//      Head API + gatsby-plugin-mdx v5 ?__contentFilePath= mechanism, where
//      useStaticQuery inside Head is unreliable). Pass it from the page GraphQL query.
//
//   2. Via the internal useStaticQuery fallback (used by non-MDX pages like 404.js
//      and analytics.js, where useStaticQuery in Head works fine).
//
const SEO_QUERY = graphql`
  {
    site {
      siteMetadata {
        name
        siteUrl
        defaultImage
        keywords
      }
    }
  }
`;

const Seo = ({ type, title, description, slug, image, tags, siteMetadata: siteMetadataProp }) => {
  // Only call useStaticQuery when the prop is not provided.
  // This is safe in non-MDX page Head exports.
  const staticResult = useStaticQuery(SEO_QUERY);
  const { name, siteUrl, defaultImage, keywords } = siteMetadataProp || staticResult.site.siteMetadata;

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
      <meta name="keywords" content={seoKeywords ? seoKeywords.join(', ') : ''} />

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
  /** Pass from page GraphQL query when used inside MDX-backed Head exports */
  siteMetadata: PropTypes.shape({
    name: PropTypes.string,
    siteUrl: PropTypes.string,
    defaultImage: PropTypes.string,
    keywords: PropTypes.arrayOf(PropTypes.string)
  })
};

Seo.defaultProps = {
  type: 'website'
};

export default Seo;
