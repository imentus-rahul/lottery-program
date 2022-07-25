import type { NextPage } from "next";
import Head from "next/head";
import { HomeView } from "../views";

const Home: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>NFT Raffle</title>
        <meta name="description" content="NFT Raffle" />
      </Head>
      <HomeView />
    </div>
  );
};

export default Home;
