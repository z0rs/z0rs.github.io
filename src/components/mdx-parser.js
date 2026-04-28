import React from 'react';
import PropTypes from 'prop-types';
import { MDXProvider } from '@mdx-js/react';

import { Link } from 'gatsby';
import { GatsbyImage, getImage } from 'gatsby-plugin-image';

import MarkdownCtaLink from './markdown-cta-link';
import PrismSyntaxHighlight from './prism-syntax-highlight.js';

import { stripLeadingSlash } from '../utils/strip-leading-slash';
import Tweet from '../components/tweet';
import YouTube from '../components/youtube';
import Vimeo from '../components/vimeo';
import LatestArticles from '../components/latest-articles';
import LatestCtfs from '../components/latest-ctfs';
import AllArticles from '../components/all-articles';
import AllCtfs from '../components/all-ctfs';

const components = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-8">
      <table className="w-full border-collapse text-[1em]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-3 py-2 text-secondary border-b-2 border-outline font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b border-outline align-top">{children}</td>
  ),

  a: ({ href, children }) => {
    // If it's an external url, use <a> and target _blank
    if (href.match(/^(http|https|mailto):/g)) {
      return (
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
    // if it's a jumplink #, use Link which will fires an anchorScroll in gatsby-browser
    if (href.match(/#/gi)) {
      return <a href={stripLeadingSlash(href)}>{children}</a>;
    }
    // if it's anything else, use Link
    return <Link to={href}>{children}</Link>;
  },
  code: ({ children, className }) => {
    return className ? (
      <PrismSyntaxHighlight className={className}>{children}</PrismSyntaxHighlight>
    ) : (
      <code>{children}</code>
    );
  },
  GatsbyImage: (props) => <GatsbyImage alt={props.alt} image={getImage(props.image)} className="my-16" />,
  MarkdownCtaLink,
  Tweet,
  YouTube,
  Vimeo,
  // Page-level components used directly in MDX files.
  // Providing them here via MDXProvider avoids direct imports inside MDX content files,
  // which are unreliable in gatsby-plugin-mdx v5 / MDX v2.
  LatestArticles,
  LatestCtfs,
  AllArticles,
  AllCtfs
};

// gatsby-plugin-mdx v5 renders MDX as React components passed directly as `children`.
// MDXRenderer (from gatsby-plugin-mdx v3) and the `body` GraphQL field no longer exist in v5.
const MdxParser = ({ children }) => {
  return <MDXProvider components={components}>{children}</MDXProvider>;
};

MdxParser.propTypes = {
  /** MDX content rendered as React children (gatsby-plugin-mdx v5) */
  children: PropTypes.node
};

export default MdxParser;
