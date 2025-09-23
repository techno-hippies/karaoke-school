import { graphql } from "@lens-protocol/client";
import { MediaImageFragment, MediaVideoFragment } from "./images";

export const PostMetadataFragment = graphql(
  `
    fragment PostMetadata on PostMetadata {
      ... on TextOnlyMetadata {
        content
      }
      ... on VideoMetadata {
        content
        video {
          ...MediaVideo
        }
        cover {
          ...MediaImage
        }
        title
      }
      ... on ImageMetadata {
        content
        image {
          ...MediaImage
        }
        title
      }
    }
  `,
  [MediaImageFragment, MediaVideoFragment]
);

export const PostFragment = graphql(
  `
    fragment Post on Post {
      id
      by {
        username {
          value
        }
        address
        metadata {
          name
          bio
        }
      }
      metadata {
        ...PostMetadata
      }
      stats {
        likes
        comments
        quotes
        reposts
        views
      }
      createdAt
    }
  `,
  [PostMetadataFragment]
);