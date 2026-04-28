import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'gatsby';
import { GatsbyImage, getImage } from 'gatsby-plugin-image';

import DateStamp from './date-stamp';

const CtfCard = ({ link, title, thumbnail, featuredImageUrl, date, dateModified, excerpt }) => {
  const image = thumbnail ? getImage(thumbnail) : null;
  return (
    <li className="m-0 p-0 rounded border border-outline bg-surface transition-all shadow-lg hover:shadow-secondary/10 hover:-translate-y-2 ease-in-out duration-500">
      <Link to={link} className="block p-4 cursor-pointer no-underline hover:text-secondary ">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {(image || featuredImageUrl) && (
            <div className="rounded shadow-lg overflow-hidden shrink-0 w-[180px]">
              {image ? (
                <GatsbyImage alt={title} image={image} />
              ) : (
                <img
                  src={featuredImageUrl}
                  alt={title}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              )}
            </div>
          )}
          <div>
            <DateStamp date={dateModified ? dateModified : date} />
            <h3 className="m-0 text-xl text-white">{title}</h3>
            <p className="m-0 text-slate-300 text-base ">{excerpt}</p>
          </div>
        </div>
      </Link>
    </li>
  );
};

CtfCard.propTypes = {
  /** The post to link to */
  link: PropTypes.string.isRequired,
  /** The title to display */
  title: PropTypes.string.isRequired,
  /** Gatsby Image Data — may be null if remote fetch failed */
  thumbnail: PropTypes.any,
  /** Featured image URL fallback from frontmatter */
  featuredImageUrl: PropTypes.string,
  /** The dateModified to display */
  dateModified: PropTypes.string,
  /** The date to display */
  date: PropTypes.string.isRequired,
  /** The excerpt to display */
  excerpt: PropTypes.string.isRequired
};

export default CtfCard;
