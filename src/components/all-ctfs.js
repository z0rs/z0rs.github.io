import React from 'react';
import { useStaticQuery, graphql } from 'gatsby';

import CtfCard from '../components/ctf-card';
import getFirstImageUrl from '../utils/get-first-image-url';

const AllCtfs = () => {
  const {
    allMdx: { nodes }
  } = useStaticQuery(graphql`
    {
      allMdx(
        filter: { frontmatter: { status: { ne: "draft" }, type: { eq: "ctf" } } }
        sort: { frontmatter: { date: DESC } }
      ) {
        nodes {
          fields {
            slug
          }
          body
          excerpt(pruneLength: 100)
          frontmatter {
            title
            date(formatString: "MMMM DD, YYYY")
            dateModified(formatString: "MMMM DD, YYYY")
            featuredImage
          }
          featuredImage {
            childImageSharp {
              thumbnail: gatsbyImageData(width: 180)
            }
          }
        }
      }
    }
  `);

  return (
    <ul className="mt-8 grid gap-8 list-none m-0 mb-8 p-0">
      {nodes.map((node, index) => {
        const {
          fields: { slug },
          body,
          excerpt,
          frontmatter: { title, date, dateModified, featuredImage: featuredImageUrl },
          featuredImage
        } = node;
        const thumbnail = featuredImage?.childImageSharp?.thumbnail ?? null;
        const contentImageUrl = getFirstImageUrl(body);
        const imageUrl = featuredImageUrl ?? contentImageUrl;

        return (
          <CtfCard
            key={index}
            link={slug}
            title={title}
            thumbnail={thumbnail}
            featuredImageUrl={imageUrl}
            date={date}
            dateModified={dateModified}
            excerpt={excerpt}
          />
        );
      })}
    </ul>
  );
};

export default AllCtfs;
