import React, { Fragment } from 'react';
import { graphql } from 'gatsby';

import MdxParser from '../components/mdx-parser';
import AsideElement from '../components/aside-element';
import DateStamp from '../components/date-stamp';
import FeaturedImageAside from '../components/featured-image-aside';
import AddReaction from '../components/add-reaction';
import Tag from '../components/tag';
import Seo from '../components/seo';
import TableOfContents from '../components/table-of-contents';
import WebmentionAside from '../components/webmention-aside';
import getFirstImageUrl from '../utils/get-first-image-url';

const Page = ({
  data: {
    mdx: {
      fields: { slug },
      body,
      excerpt,
      frontmatter: { type, title, date, dateModified, author, tags, featuredImage: frontmatterFeaturedImage },
      featuredImage,
      embeddedImages,
      tableOfContents: { items: toc }
    },
    site: {
      siteMetadata: { siteUrl }
    }
  },
  children
}) => {
  const thumbnail = featuredImage?.childImageSharp?.thumbnail ?? null;
  const contentImageUrl = getFirstImageUrl(body);
  const featuredImageUrl = frontmatterFeaturedImage ?? contentImageUrl;
  return (
    <Fragment>
      <div className="grid lg:grid-cols-1fr-auto">
        <DateStamp date={dateModified ? dateModified : date} />
        <small className="leading-6 font-semibold text-secondary">Author &bull; {author}</small>
      </div>
      <h1 className="my-12 text-3xl sm:text-5xl">{title}</h1>
      <ul className="list-none m-0 p-0 flex flex-wrap gap-2 mb-12">
        {tags
          ? tags.map((tag, index) => {
            return (
              <li key={index} className="m-0 p-0">
                <Tag tag={tag} />
              </li>
            );
          })
          : null}
      </ul>
      <MdxParser embedded={embeddedImages}>{children}</MdxParser>
      <AddReaction title={title} slug={slug} />
      <AsideElement>
        <FeaturedImageAside
          alt={title}
          thumbnail={thumbnail}
          featuredImageUrl={featuredImageUrl}
          shareText={`${title}\n ${siteUrl}${slug}`}
        />
        {toc ? (
          <div className="px-6">
            <h5 className="mb-3 text-lg leading-6 font-semibold uppercase text-secondary">On this page</h5>
            <TableOfContents slug={slug} items={toc} />
          </div>
        ) : null}
        <WebmentionAside target={`https://z0rs.github.io${slug}`} />
      </AsideElement>
    </Fragment>
  );
};

export const query = graphql`
  query ($id: String!) {
    mdx(id: { eq: $id }) {
      fields {
        slug
      }
      body
      excerpt
      frontmatter {
        type
        title
        date(formatString: "MMMM DD, YYYY")
        dateModified(formatString: "MMMM DD, YYYY")
        author
        tags
        featuredImage
      }
      featuredImage {
        childImageSharp {
          thumbnail: gatsbyImageData(width: 240)
          og: gatsbyImageData(width: 1200)
        }
      }
      embeddedImages {
        childImageSharp {
          gatsbyImageData(layout: FULL_WIDTH)
        }
      }
      tableOfContents
    }
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

export default Page;

export const Head = ({
  data: {
    mdx: {
      fields: { slug },
      body,
      excerpt,
      frontmatter: { type, title, tags, featuredImage: frontmatterFeaturedImage },
      featuredImage
    },
    site: { siteMetadata }
  }
}) => {
  const contentImageUrl = getFirstImageUrl(body);
  const ogImage = featuredImage?.childImageSharp?.og?.images?.fallback?.src ?? frontmatterFeaturedImage ?? contentImageUrl ?? null;
  return (
    <Seo type="article" title={title} description={excerpt} slug={slug} image={ogImage} tags={tags} siteMetadata={siteMetadata} />
  );
};
