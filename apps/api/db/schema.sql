--
-- PostgreSQL database dump
--

\restrict hvsIilVi08Vc6AAIKTptiSvYkKy73FhQm3W7MinIF3HbymlSrKIN6mER0ogMfa0

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: application_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    status character varying NOT NULL,
    note text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "applicationId" uuid
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "jobId" uuid NOT NULL,
    status character varying DEFAULT 'applied'::character varying NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tokenHash" character varying NOT NULL,
    "userId" uuid NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    type character varying NOT NULL,
    message text NOT NULL,
    page character varying,
    "matchId" uuid,
    "resolvedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source character varying NOT NULL,
    "externalId" character varying NOT NULL,
    title character varying NOT NULL,
    company character varying NOT NULL,
    location character varying,
    "workModel" character varying,
    description text NOT NULL,
    url character varying NOT NULL,
    "publishedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "salaryMin" integer,
    "salaryMax" integer,
    area character varying
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    "jobId" uuid NOT NULL,
    score integer NOT NULL,
    reasons text[] NOT NULL,
    "missingSkills" text[] NOT NULL,
    "englishRequired" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    decision character varying,
    "decisionReason" text,
    "decidedAt" timestamp with time zone,
    "minYears" integer,
    "coverLetter" text,
    "coverLetterAt" timestamp with time zone,
    schedule character varying,
    "contractType" character varying
);


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_resets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tokenHash" character varying NOT NULL,
    "userId" uuid NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.preferences (
    "userId" uuid NOT NULL,
    "currentSalary" integer,
    "targetSalaryMin" integer,
    "targetSalaryMax" integer,
    roles text[] DEFAULT '{}'::text[] NOT NULL,
    avoid text[] DEFAULT '{}'::text[] NOT NULL,
    "excludeKeywords" text[] DEFAULT '{}'::text[] NOT NULL,
    "onsiteLocations" text[] DEFAULT '{}'::text[] NOT NULL,
    "hybridLocations" text[] DEFAULT '{}'::text[] NOT NULL,
    "remoteAnywhere" boolean DEFAULT true NOT NULL,
    "maxYears" integer DEFAULT 3 NOT NULL,
    notes text,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "githubUsername" character varying,
    "dailyEmail" boolean DEFAULT true NOT NULL,
    "digestMinScore" integer DEFAULT 60 NOT NULL,
    "emailDays" integer[] DEFAULT '{1,2,3,4,5,6,0}'::integer[] NOT NULL,
    "emailTimes" text[] DEFAULT '{08:30}'::text[] NOT NULL,
    "emailMaxJobs" integer DEFAULT 10 NOT NULL,
    "lastDigestAt" timestamp with time zone,
    sector character varying,
    areas text[] DEFAULT '{}'::text[] NOT NULL,
    district character varying,
    city character varying,
    "maxDistanceKm" integer,
    shifts text[] DEFAULT '{}'::text[] NOT NULL,
    "contractTypes" text[] DEFAULT '{}'::text[] NOT NULL,
    "workTime" character varying
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    "userId" uuid NOT NULL,
    title character varying NOT NULL,
    "yearsExperience" integer NOT NULL,
    seniority character varying NOT NULL,
    skills text[] NOT NULL,
    languages text[] NOT NULL,
    location character varying,
    summary text NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    sector character varying,
    "suggestedRoles" text[] DEFAULT '{}'::text[] NOT NULL,
    education character varying,
    "drivingLicense" character varying,
    source character varying DEFAULT 'cv'::character varying NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tokenHash" character varying NOT NULL,
    "userId" uuid NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    "passwordHash" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "emailVerifiedAt" timestamp with time zone,
    "termsAcceptedAt" timestamp with time zone
);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: profiles PK_315ecd98bd1a42dcf2ec4e2e985; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT "PK_315ecd98bd1a42dcf2ec4e2e985" PRIMARY KEY ("userId");


--
-- Name: sessions PK_3238ef96f18b355b671619111bc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY (id);


--
-- Name: password_resets PK_4816377aa98211c1de34469e742; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT "PK_4816377aa98211c1de34469e742" PRIMARY KEY (id);


--
-- Name: feedback PK_8389f9e087a57689cd5be8b2b13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT "PK_8389f9e087a57689cd5be8b2b13" PRIMARY KEY (id);


--
-- Name: matches PK_8a22c7b2e0828988d51256117f4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY (id);


--
-- Name: applications PK_938c0a27255637bde919591888f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: email_verifications PK_c1ea2921e767f83cd44c0af203f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT "PK_c1ea2921e767f83cd44c0af203f" PRIMARY KEY (id);


--
-- Name: jobs PK_cf0a6c42b72fcc7f7c237def345; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY (id);


--
-- Name: preferences PK_eb2de5fbaa61832e982f53d9716; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT "PK_eb2de5fbaa61832e982f53d9716" PRIMARY KEY ("userId");


--
-- Name: application_events PK_fd185969787381d8bf8c529bc00; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_events
    ADD CONSTRAINT "PK_fd185969787381d8bf8c529bc00" PRIMARY KEY (id);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: IDX_4278e9ac6ba205b31425366260; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_4278e9ac6ba205b31425366260" ON public.jobs USING btree (source, "externalId");


--
-- Name: IDX_4a39e6ac0cecdf18307a365cf3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4a39e6ac0cecdf18307a365cf3" ON public.feedback USING btree ("userId");


--
-- Name: IDX_7f6aae0fcc807c9e7194ca5cc4; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_7f6aae0fcc807c9e7194ca5cc4" ON public.password_resets USING btree ("tokenHash");


--
-- Name: IDX_98ec82a9dd0fd9a589350655c9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_98ec82a9dd0fd9a589350655c9" ON public.matches USING btree ("userId", "jobId");


--
-- Name: IDX_a2722f28b8d617c3696c8c125b; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_a2722f28b8d617c3696c8c125b" ON public.applications USING btree ("userId", "jobId");


--
-- Name: IDX_bace6c68efc156fddac9b14bda; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_bace6c68efc156fddac9b14bda" ON public.sessions USING btree ("tokenHash");


--
-- Name: IDX_ce0a8d27a7e9e49d49865e3e1a; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_ce0a8d27a7e9e49d49865e3e1a" ON public.email_verifications USING btree ("tokenHash");


--
-- Name: matches FK_0e1f5006d52bcbc4936d2f18ace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT "FK_0e1f5006d52bcbc4936d2f18ace" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profiles FK_315ecd98bd1a42dcf2ec4e2e985; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: feedback FK_4a39e6ac0cecdf18307a365cf3c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT "FK_4a39e6ac0cecdf18307a365cf3c" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_verifications FK_4e63a91e0a684b31496bd50733e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT "FK_4e63a91e0a684b31496bd50733e" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions FK_57de40bc620f456c7311aa3a1e6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: applications FK_90ad8bec24861de0180f638b9cc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT "FK_90ad8bec24861de0180f638b9cc" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: matches FK_c78636ff8f8f666c6dc04155c57; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT "FK_c78636ff8f8f666c6dc04155c57" FOREIGN KEY ("jobId") REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: password_resets FK_d95569f623f28a0bf034a55099e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT "FK_d95569f623f28a0bf034a55099e" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: preferences FK_eb2de5fbaa61832e982f53d9716; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT "FK_eb2de5fbaa61832e982f53d9716" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: application_events FK_f3db5d0c3088d18f39d95bfec78; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_events
    ADD CONSTRAINT "FK_f3db5d0c3088d18f39d95bfec78" FOREIGN KEY ("applicationId") REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: applications FK_f6ebb8bc5061068e4dd97df3c77; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT "FK_f6ebb8bc5061068e4dd97df3c77" FOREIGN KEY ("jobId") REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict hvsIilVi08Vc6AAIKTptiSvYkKy73FhQm3W7MinIF3HbymlSrKIN6mER0ogMfa0

