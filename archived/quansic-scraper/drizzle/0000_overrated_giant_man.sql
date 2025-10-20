CREATE TABLE "genius_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"genius_album_id" text,
	"name" text,
	"artist_name" text,
	"release_date" text,
	"cover_art_url" text,
	"url" text,
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "genius_albums_genius_album_id_unique" UNIQUE("genius_album_id")
);
--> statement-breakpoint
CREATE TABLE "genius_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"genius_artist_id" text,
	"name" text,
	"image_url" text,
	"is_verified" integer DEFAULT 0,
	"url" text,
	"fetched_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "genius_artists_genius_artist_id_unique" UNIQUE("genius_artist_id")
);
--> statement-breakpoint
CREATE TABLE "genius_media_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text,
	"provider" text,
	"url" text,
	"native_uri" text,
	"start_time" integer
);
--> statement-breakpoint
CREATE TABLE "genius_publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"genius_publisher_id" text,
	"name" text,
	"url" text,
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "genius_publishers_genius_publisher_id_unique" UNIQUE("genius_publisher_id")
);
--> statement-breakpoint
CREATE TABLE "genius_song_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text,
	"genius_artist_id" text,
	"role" text,
	"credited_as" text,
	"order_index" integer
);
--> statement-breakpoint
CREATE TABLE "genius_song_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_song_id" text,
	"target_genius_id" text,
	"target_title" text,
	"target_artist" text,
	"relationship_type" text,
	"url" text,
	"fetched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "genius_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text,
	"genius_id" text,
	"title" text,
	"full_title" text,
	"artist_names" text,
	"pageviews" integer,
	"hot" integer DEFAULT 0,
	"lyrics_state" text,
	"release_date" text,
	"recording_location" text,
	"description" text,
	"url" text,
	"song_art_image_url" text,
	"primary_tag" text,
	"tags" json,
	"fetched_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "genius_tracks_song_id_unique" UNIQUE("song_id"),
	CONSTRAINT "genius_tracks_genius_id_unique" UNIQUE("genius_id")
);
--> statement-breakpoint
CREATE TABLE "spotify_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_artist_id" text,
	"spotify_artist_uri" text,
	"name" text,
	"href" text,
	"external_url" text,
	"genres" json,
	"popularity" integer,
	"follower_count" integer,
	"image_url" text,
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "spotify_artists_spotify_artist_id_unique" UNIQUE("spotify_artist_id")
);
--> statement-breakpoint
CREATE TABLE "spotify_audio_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text,
	"spotify_track_id" text,
	"acousticness" real,
	"danceability" real,
	"energy" real,
	"instrumentalness" real,
	"liveness" real,
	"loudness" real,
	"speechiness" real,
	"valence" real,
	"tempo" real,
	"key" integer,
	"mode" integer,
	"time_signature" integer,
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "spotify_audio_features_song_id_unique" UNIQUE("song_id"),
	CONSTRAINT "spotify_audio_features_spotify_track_id_unique" UNIQUE("spotify_track_id")
);
--> statement-breakpoint
CREATE TABLE "spotify_track_artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_track_id" text,
	"spotify_artist_id" text,
	"artist_order" integer,
	"is_album_artist" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "spotify_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text,
	"spotify_track_id" text,
	"spotify_track_uri" text,
	"spotify_album_id" text,
	"spotify_album_uri" text,
	"clean_title" text,
	"album_name" text,
	"album_type" text,
	"release_date" text,
	"release_date_precision" text,
	"duration_ms" integer,
	"explicit" integer,
	"popularity" integer,
	"track_number" integer,
	"disc_number" integer,
	"total_tracks" integer,
	"preview_url" text,
	"album_image_large" text,
	"album_image_medium" text,
	"album_image_small" text,
	"available_markets" json,
	"market_count" integer,
	"fetched_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "spotify_tracks_song_id_unique" UNIQUE("song_id"),
	CONSTRAINT "spotify_tracks_spotify_track_id_unique" UNIQUE("spotify_track_id")
);
--> statement-breakpoint
CREATE TABLE "artist_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" text,
	"alias" text NOT NULL,
	"type" text
);
--> statement-breakpoint
CREATE TABLE "artist_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" text,
	"related_artist_id" text,
	"relationship_type" text,
	"start_date" text,
	"end_date" text
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"nationality" text,
	"birth_date" text,
	"death_date" text,
	"isni" text,
	"ipi" text,
	"spotify_id" text,
	"musicbrainz_id" text,
	"discogs_id" text,
	"image" text,
	"comments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "artists_isni_unique" UNIQUE("isni")
);
--> statement-breakpoint
CREATE TABLE "ingestion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"status" text NOT NULL,
	"message" text,
	"raw_data" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist_id" text,
	"type" text,
	"upc" text,
	"ean" text,
	"year" text,
	"label" text,
	"cover" text,
	"discogs_master_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "releases_upc_unique" UNIQUE("upc")
);
--> statement-breakpoint
CREATE TABLE "royalty_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" text,
	"payee" text NOT NULL,
	"percentage" real NOT NULL,
	"role" text,
	"verified_by" text,
	"verification_date" text,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist_id" text,
	"release_id" text,
	"isrc" text,
	"iswc" text,
	"duration" text,
	"duration_ms" integer,
	"year" text,
	"track_number" integer,
	"spotify_verified" integer DEFAULT 0,
	"genius_verified" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "songs_isrc_unique" UNIQUE("isrc")
);
--> statement-breakpoint
ALTER TABLE "genius_media_links" ADD CONSTRAINT "genius_media_links_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genius_song_credits" ADD CONSTRAINT "genius_song_credits_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genius_song_relationships" ADD CONSTRAINT "genius_song_relationships_source_song_id_songs_id_fk" FOREIGN KEY ("source_song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "genius_tracks" ADD CONSTRAINT "genius_tracks_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_audio_features" ADD CONSTRAINT "spotify_audio_features_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_tracks" ADD CONSTRAINT "spotify_tracks_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_aliases" ADD CONSTRAINT "artist_aliases_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_relationships" ADD CONSTRAINT "artist_relationships_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_relationships" ADD CONSTRAINT "artist_relationships_related_artist_id_artists_id_fk" FOREIGN KEY ("related_artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_splits" ADD CONSTRAINT "royalty_splits_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_genius_albums_genius_id" ON "genius_albums" USING btree ("genius_album_id");--> statement-breakpoint
CREATE INDEX "idx_genius_artists_genius_id" ON "genius_artists" USING btree ("genius_artist_id");--> statement-breakpoint
CREATE INDEX "idx_genius_media_links_song_id" ON "genius_media_links" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_genius_media_links_provider" ON "genius_media_links" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_genius_publishers_id" ON "genius_publishers" USING btree ("genius_publisher_id");--> statement-breakpoint
CREATE INDEX "idx_genius_credits_song_id" ON "genius_song_credits" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_genius_credits_artist_id" ON "genius_song_credits" USING btree ("genius_artist_id");--> statement-breakpoint
CREATE INDEX "idx_genius_credits_role" ON "genius_song_credits" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_genius_relationships_source" ON "genius_song_relationships" USING btree ("source_song_id");--> statement-breakpoint
CREATE INDEX "idx_genius_relationships_type" ON "genius_song_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "idx_genius_tracks_song_id" ON "genius_tracks" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_genius_tracks_genius_id" ON "genius_tracks" USING btree ("genius_id");--> statement-breakpoint
CREATE INDEX "idx_genius_tracks_pageviews" ON "genius_tracks" USING btree ("pageviews");--> statement-breakpoint
CREATE INDEX "idx_spotify_artists_spotify_id" ON "spotify_artists" USING btree ("spotify_artist_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_audio_features_song_id" ON "spotify_audio_features" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_audio_features_spotify_id" ON "spotify_audio_features" USING btree ("spotify_track_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_track_artists_track" ON "spotify_track_artists" USING btree ("spotify_track_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_track_artists_artist" ON "spotify_track_artists" USING btree ("spotify_artist_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_tracks_song_id" ON "spotify_tracks" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_tracks_spotify_id" ON "spotify_tracks" USING btree ("spotify_track_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_tracks_popularity" ON "spotify_tracks" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "idx_artists_isni" ON "artists" USING btree ("isni");--> statement-breakpoint
CREATE INDEX "idx_artists_name" ON "artists" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_ingestion_log_created_at" ON "ingestion_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ingestion_log_status" ON "ingestion_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_releases_upc" ON "releases" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "idx_releases_artist_id" ON "releases" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_songs_isrc" ON "songs" USING btree ("isrc");--> statement-breakpoint
CREATE INDEX "idx_songs_artist_id" ON "songs" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_songs_release_id" ON "songs" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "idx_songs_spotify_verified" ON "songs" USING btree ("spotify_verified");--> statement-breakpoint
CREATE INDEX "idx_songs_genius_verified" ON "songs" USING btree ("genius_verified");