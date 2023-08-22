import React from 'react';
import { useStaticQuery, graphql } from 'gatsby';

import ArticleCard from '../components/article-card';

const AllArticles = () => {
  const {
    allMdx: { nodes }
  } = useStaticQuery(graphql`
    {
      allMdx(
        filter: { frontmatter: { status: { ne: "draft" }, type: { eq: "article" } } }
        sort: { frontmatter: { date: DESC } }
      ) {
        nodes {
          fields {
            slug
          }
          excerpt(pruneLength: 100)
          frontmatter {
            title
            date(formatString: "MMMM DD, YYYY")
            dateModified(formatString: "MMMM DD, YYYY")
          }
          featuredImage {
            childImageSharp {
              thumbnail: gatsbyImageData(width: 320)
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
          excerpt,
          frontmatter: { title, date, dateModified },
          featuredImage: {
            childImageSharp: { thumbnail }
          }
        } = node;

        return (
          <ArticleCard
            key={index}
            link={slug}
            title={title}
            thumbnail={thumbnail}
            date={date}
            dateModified={dateModified}
            excerpt={excerpt}
          />
        );
      })}
    </ul>
  );
};

export default AllArticles;
