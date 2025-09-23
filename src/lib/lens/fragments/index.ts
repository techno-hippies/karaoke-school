import type { FragmentOf } from "@lens-protocol/client";

import { AccountFragment, AccountMetadataFragment } from "./accounts";
import { PostMetadataFragment, PostFragment } from "./posts";

declare module "@lens-protocol/client" {
  export interface Account extends FragmentOf<typeof AccountFragment> {}
  export interface AccountMetadata extends FragmentOf<typeof AccountMetadataFragment> {}
  export type PostMetadata = FragmentOf<typeof PostMetadataFragment>;
  export type Post = FragmentOf<typeof PostFragment>;
}

export const fragments = [
  AccountFragment,
  PostFragment,
  PostMetadataFragment,
];