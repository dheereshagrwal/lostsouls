import React, { useState, useEffect } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import axios from "axios";
const ipfsHttpClient = require("ipfs-http-client");
import { MarketAddress, MarketAddressABI } from "./constants";

const INFURA_ID = "2Ozh7HSv2hQLliso6mr9vRxZKir";
const INFURA_SECRET_KEY = "3312cf18b201260d27b70514db45956d";

const auth = `Basic ${Buffer.from(`${INFURA_ID}:${INFURA_SECRET_KEY}`).toString(
  "base64"
)}`;
const client = ipfsHttpClient.create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: auth,
  },
});
const fetchContract = (signerOrProvider) =>
  new ethers.Contract(MarketAddress, MarketAddressABI, signerOrProvider);
export const NFTContext = React.createContext();

export const NFTProvider = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState("");
  const nftCurrency = "ETH";
  const checkIfWalletIsConnected = async () => {
    if (!window.ethereum) {
      return alert("Please install MetaMask first.");
    }
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length) {
      setCurrentAccount(accounts[0]);
    } else {
      console.log("No authorized account found");
    }
  };
  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      return alert("Please install MetaMask first.");
    }
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    setCurrentAccount(accounts[0]);
    window.location.reload();
  };

  const uploadToIPFS = async (file) => {
    try {
      const added = await client.add({ content: file });
      const url = `https://lostsouls.infura-ipfs.io/ipfs/${added.path}`;
      return url;
    } catch (error) {
      console.log("Error uploading file to IPFS: ", error);
    }
  };

  const createNFT = async (formInput, fileUrl, router) => {
    const { name, description, price } = formInput;
    if (!name || !description || !price || !fileUrl) {
      return alert("All fields are required");
    }
    const data = JSON.stringify({
      name,
      description,
      image: fileUrl,
    });
    try {
      const added = await client.add(data);
      const url = `https://lostsouls.infura-ipfs.io/ipfs/${added.path}`;
      await createSale(url, price);
      router.push("/");
    } catch (error) {
      console.log("Error uploading file to IPFS: ", error);
    }
  };
  const createSale = async (url, formInputPrice, isReselling, id) => {
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();
    const price = ethers.utils.parseUnits(formInputPrice, "ether");

    const contract = fetchContract(signer);
    const listingPrice = await contract.getListingPrice();

    const transaction = await contract.createToken(url, price, {
      value: listingPrice.toString(),
    });
    await transaction.wait();
  };

  const fetchNFTs = async () => {
    const provider = new ethers.providers.JsonRpcProvider();
    const contract = fetchContract(provider);
    const data = await contract.fetchMarketItems();
    console.log("data", data);
    const items = await Promise.all(
      data.map(async ({ tokenId, seller, owner, price: unformattedPrice }) => {
        const tokenURI = await contract.tokenURI(tokenId);
        console.log("tokenURI", tokenURI);
        const {
          data: { image, name, description },
        } = await axios.get(tokenURI);
        console.log("unformattedPrice", unformattedPrice);
        const price = ethers.utils.parseUnits(
          unformattedPrice.toString(),
          "ether"
        );
        console.log("price", price);
        return {
          price,
          tokenId: tokenId.toNumber(),
          seller,
          owner,
          image,
          name,
          description,
          tokenURI,
        };
      })
    );
    return items;
  };
  return (
    <NFTContext.Provider
      value={{
        nftCurrency,
        connectWallet,
        currentAccount,
        uploadToIPFS,
        createNFT,
        fetchNFTs,
      }}
    >
      {children}
    </NFTContext.Provider>
  );
};
