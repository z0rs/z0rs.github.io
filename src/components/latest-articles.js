import React from 'react';
import { useStaticQuery, graphql, Link } from 'gatsby';

import ArticleCard from '../components/article-card';

const LatestArticles = () => {
  const {
    allMdx: { nodes }
  } = useStaticQuery(graphql`
    {
      allMdx(
        filter: { frontmatter: { status: { ne: "draft" }, type: { eq: "article" } } }
        sort: { frontmatter: { date: DESC } }
        limit: 7
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
    <section>
      <h2 className="m-0 text-2xl uppercase text-salmon">Latest Articles</h2>
      <p className="mt-0 mb-8 text-slate-300 text-base">
        You can find the Latest Articles here, on the topic of vulnerabilities and CTF.
      </p>
      <ul className="grid gap-8 list-none m-0 mb-8 p-0">
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
      <div className="flex justify-center">
        <Link to="/articles" className="flex gap-2 items-center no-underline">
          More Articles{' '}
          <span role="img" aria-label="pencil">
            ✏️
          </span>
        </Link>
      </div>
    </section>
  );
};

export default LatestArticles;
