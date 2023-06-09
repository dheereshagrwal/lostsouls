import React, { useState, useEffect } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import axios from "axios";
import { MarketAddress, MarketAddressABI } from "./constants";

const INFURA_URL = process.env.NEXT_PUBLIC_INFURA_URL;

const fetchContract = (signerOrProvider) =>
  new ethers.Contract(MarketAddress, MarketAddressABI, signerOrProvider);
export const NFTContext = React.createContext();

export const NFTProvider = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState("");
  const [isLoadingNFT, setIsLoadingNFT] = useState(false);
  const nftCurrency = "Ξ";
  const checkIfWalletIsConnected = async () => {
    if (!window.ethereum) {
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts.length) {
        setCurrentAccount(accounts[0]);
      } else {
        console.log("No authorized account found");
      }
    } catch (error) {
      console.log("Error while checking connected wallet:", error);
    }
  };
  const handleAccountsChanged = (accounts) => {
    if (accounts.length) {
      setCurrentAccount(accounts[0]);
    } else {
      console.log("No authorized account found");
    }
  };
  useEffect(() => {
    checkIfWalletIsConnected();
    if (window.ethereum) {
      window.ethereum.addListener("accountsChanged", handleAccountsChanged);
      return () => {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      return alert("Please install MetaMask first. (use sepolia ETH)");
    }
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    setCurrentAccount(accounts[0]);
  };

  const uploadToIPFS = async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const { url } = await response.json();
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
      const response = await fetch("/api/create-nft", {
        method: "POST",
        body: data,
        headers: {
          "Content-Type": "application/json",
        },
      });
      const { url } = await response.json();
      await createSale(url, price);
      router.push("/");
    } catch (error) {
      console.log("Error uploading file to IPFS: ", error);
    }
  };
  const createSale = async (url, formInputPrice, isReselling, id) => {
    if (!formInputPrice || !url) {
      alert("All fields are required");
      return window.location.reload();
    }
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();
    console.log("formInputPrice", formInputPrice);
    const price = ethers.utils.parseUnits(formInputPrice, "ether");

    try {
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
    } catch (error) {
      alert("An error occurred. Please try again.");
      console.error(error);
      return window.location.reload();
    }
  };

  const fetchNFTs = async () => {
    setIsLoadingNFT(false);
    const provider = new ethers.providers.JsonRpcProvider(INFURA_URL);
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
