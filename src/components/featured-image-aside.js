import React from 'react';
import PropTypes from 'prop-types';
import { GatsbyImage, getImage } from 'gatsby-plugin-image';
import NavigationIcon from './navigation-icon';

const FeaturedImageAside = ({ alt, thumbnail, shareText }) => {
  return (
    <div className="grid gap-4 rounded border border-outline bg-surface/50 px-4 sm:px-6 py-6">
      <div className="rounded shadow-lg overflow-hidden w-full">
        <GatsbyImage alt={alt} image={getImage(thumbnail)} />
      </div>
      <a
        href={`https://www.linkedin.com/shareArticle?mini=true&url=${shareText}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-4 no-underline text-sm text-center py-2 px-4 transition-all duration-300 rounded border border-outline bg-surface hover:text-white hover:bg-muted/20"
      >
        <NavigationIcon icon="M21.4,0.64H2.72c-1.14,0-2.02,0.88-2.02,2.02v18.55c0,1.26,0.88,2.15,2.02,2.15h18.55c1.14,0,2.02-0.88,2.02-2.02V2.66C23.42,1.52,22.53,0.64,21.4,0.64z M7.89,19.19H4.86V9.48h3.03C7.89,9.48,7.89,19.19,7.89,19.19z M6.38,8.09c-1.01,0-1.77-0.76-1.77-1.77s0.76-1.89,1.77-1.89s1.77,0.76,1.77,1.77S7.26,8.09,6.38,8.09z M19.25,19.19h-3.03v-4.67c0-1.14,0-2.65-1.64-2.65s-1.77,1.26-1.77,2.52v4.8H9.79V9.48h2.9v1.26l0,0c0.38-0.76,1.39-1.64,2.9-1.64c3.03,0,3.66,2.02,3.66,4.67C19.25,13.89,19.25,19.19,19.25,19.19z" />
        Share on LinkedIn
      </a>
    </div>
  );
};

FeaturedImageAside.propTypes = {
  /** The image alt tag */
  alt: PropTypes.string.isRequired,
  /** Gatsby Image Data */
  thumbnail: PropTypes.any.isRequired,
  /** The text to populate the Tweet */
  shareText: PropTypes.string.isRequired
};

export default FeaturedImageAside;
