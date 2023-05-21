import React, { useState, useEffect } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import axios from "axios";
import { create as ipfsHttpClient } from "ipfs-http-client";
import { MarketAddress, MarketAddressABI } from "./constants";

const IPFS_API_KEY = process.env.NEXT_PUBLIC_IPFS_API_KEY;
const IPFS_API_KEY_SECRET = process.env.NEXT_PUBLIC_IPFS_API_KEY_SECRET;
const IPFS_DEDICATED_GATEWAY_SUBDOMAIN =
  process.env.NEXT_PUBLIC_IPFS_DEDICATED_GATEWAY_SUBDOMAIN;
const auth = `Basic ${Buffer.from(
  `${IPFS_API_KEY}:${IPFS_API_KEY_SECRET}`
).toString("base64")}`;
const client = ipfsHttpClient({
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
  const [isLoadingNFT, setIsLoadingNFT] = useState(false);
  const nftCurrency = "Ξ";
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
      const url = `${IPFS_DEDICATED_GATEWAY_SUBDOMAIN}/ipfs/${added.path}`;
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
      const url = `${IPFS_DEDICATED_GATEWAY_SUBDOMAIN}/ipfs/${added.path}`;
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

    const transaction = !isReselling
      ? await contract.createToken(url, price, {
          value: listingPrice.toString(),
        })
      : await contract.resellToken(id, price, {
          value: listingPrice.toString(),
        });
    setIsLoadingNFT(true);
    await transaction.wait();
  };

  const fetchNFTs = async () => {
    setIsLoadingNFT(false);
    const provider = new ethers.providers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/tr6z5zzw0vPOYy2U3jZm0pl2gq3R1hLH"
    );
    const contract = fetchContract(provider);
    const data = await contract.fetchMarketItems();
    const items = await Promise.all(
      data.map(async ({ tokenId, seller, owner, price: unformattedPrice }) => {
        const tokenURI = await contract.tokenURI(tokenId);
        const {
          data: { image, name, description },
        } = await axios.get(tokenURI);
        const price = ethers.utils.formatUnits(
          unformattedPrice.toString(),
          "ether"
        );
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
      // npx hardhat run scripts/deploy.js --network sepolia
    );
    return items;
  };
  const fetchMyNFTsOrListedNFTs = async (type) => {
    setIsLoadingNFT(false);
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();

    const contract = fetchContract(signer);
    const data =
      type === "fetchItemsListed"
        ? await contract.fetchItemsListed()
        : await contract.fetchMyNFTs();

    const items = await Promise.all(
      data.map(async ({ tokenId, seller, owner, price: unformattedPrice }) => {
        const tokenURI = await contract.tokenURI(tokenId);
        const {
          data: { image, name, description },
        } = await axios.get(tokenURI);
        const price = ethers.utils.formatUnits(
          unformattedPrice.toString(),
          "ether"
        );
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
      // npx hardhat run scripts/deploy.js --network localhost
    );
    return items;
  };

  const buyNFT = async (nft) => {
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();
    const contract = fetchContract(signer);

    const price = ethers.utils.parseUnits(nft.price.toString(), "ether");
    const transaction = await contract.createMarketSale(nft.tokenId, {
      value: price,
    });
    setIsLoadingNFT(true);
    await transaction.wait();
    setIsLoadingNFT(false);
  };
  return (
    <NFTContext.Provider
      value={{
        nftCurrency,
        connectWallet,
        currentAccount,
        uploadToIPFS,
        createNFT,
        createSale,
        fetchNFTs,
        fetchMyNFTsOrListedNFTs,
        buyNFT,
        isLoadingNFT,
      }}
    >
      {children}
    </NFTContext.Provider>
  );
};
