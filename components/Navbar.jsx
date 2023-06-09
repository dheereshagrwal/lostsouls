import React, { useState, useContext, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";

import { Button } from ".";
import images from "../assets";
import { NFTContext } from "../context/NFTContext";

const MenuItems = ({ isMobile, active, setActive, setIsOpen }) => {
  const generateLink = (i) => {
    switch (i) {
      case 0:
        return "/";
      case 1:
        return "/listed-nfts";
      case 2:
        return "/my-nfts";
      default:
        return "/";
    }
  };

  return (
    <ul
      className={`list-none flexCenter flex-row ${
        isMobile && "flex-col h-full"
      }`}
    >
      {["explore souls", "souls for sale", "my souls"].map((item, i) => (
        <li
          key={i}
          onClick={() => {
            setActive(item);
            if (isMobile) {
              setIsOpen(false);
            }
          }}
          className={`flex flex-row items-center font-poppins font-semibold text-base hover:text-white  mx-3 ${
            active === item ? "text-white" : "text-neutral-500"
          }`}
        >
          <Link href={generateLink(i)} shallow={true}>
            {item}
          </Link>
        </li>
      ))}
    </ul>
  );
};

const ButtonGroup = ({
  router,
  setActive,
  setIsOpen,
  connectWallet,
  currentAccount,
}) => {
  return currentAccount ? (
    <Button
      btnName="create"
      classStyles="mx-2 rounded-xl"
      handleClick={() => {
        setActive("");
        setIsOpen(false);
        router.push("/create-nft");
      }}
    />
  ) : (
    <Button
      btnName="connect"
      classStyles="mx-2 rounded-xl"
      handleClick={() => {
        setIsOpen(false);
        connectWallet();
      }}
    />
  );
};

const checkActive = (
  active,
  setActive,
  router,
  connectWallet,
  currentAccount
) => {
  switch (router.pathname) {
    case "/": {
      if (active !== "explore souls") {
        setActive("explore souls");
      }
      break;
    }
    case "/listed-nfts": {
      if (!currentAccount) {
        connectWallet();
        router.push("/");
      } else {
        if (active !== "souls for sale") {
          setActive("souls for sale");
        }
      }
      break;
    }
    case "/my-nfts": {
      if (!currentAccount) {
        connectWallet();
        router.push("/");
      } else {
        if (active !== "my souls") {
          setActive("my souls");
        }
      }
      break;
    }
    case "/create-nft": {
      setActive("");
      break;
    }
    default: {
      setActive("");
      break;
    }
  }
};

const Navbar = () => {
  const router = useRouter();
  const [active, setActive] = useState("explore souls");
  const [isOpen, setIsOpen] = useState(false);
  const { connectWallet, currentAccount } = useContext(NFTContext);

  useEffect(() => {
    checkActive(active, setActive, router, connectWallet, currentAccount);
  }, [router.pathname]);

  return (
    <nav className="flexBetween w-full fixed z-10 p-4 flex-row backdrop-blur-md">
      <div className="flex flex-1 flex-row justify-start">
        <Link href="/" shallow={true}>
          <div
            className="flexCenter md:hidden cursor-pointer"
            onClick={() => {
              setActive("explore souls");
            }}
          >
            <Image src={images.logo} className="w-16 h-16" alt="logo" />
            <p className="text-white font-semibold text-lg ml-1 font-poppins">
              LostSouls
            </p>
          </div>
        </Link>
        <Link href="/" shallow={true}>
          <div
            className="hidden md:flex"
            onClick={() => {
              setActive("explore souls");
              setIsOpen(false);
            }}
          >
            <Image src={images.logo} className="w-16 h-16" alt="logo" />
          </div>
        </Link>
      </div>
      <div className="flex flex-initial flex-row justify-end">
        <div className="md:hidden flex">
          <MenuItems active={active} setActive={setActive} />
          <div className="ml-4">
            <ButtonGroup
              setActive={setActive}
              router={router}
              setIsOpen={setIsOpen}
              connectWallet={connectWallet}
              currentAccount={currentAccount}
            />
          </div>
        </div>
      </div>
      <div className="hidden md:flex ml-2">
        {isOpen ? (
          <Image
            src={images.cross}
            width={25}
            height={20}
            alt="close"
            onClick={() => setIsOpen(false)}
          />
        ) : (
          <Image
            src={images.menu}
            width={25}
            height={25}
            alt="menu"
            onClick={() => setIsOpen(true)}
          />
        )}
        {isOpen && (
          <div className="fixed inset-0 top-65 bg-neutral-900 z-10 flex justify-between flex-col mt-2">
            <div className="flex-1 p-4">
              <MenuItems
                active={active}
                setActive={setActive}
                isMobile
                setIsOpen={setIsOpen}
              />
            </div>
            <div className="p-4">
              <ButtonGroup
                setActive={setActive}
                router={router}
                setIsOpen={setIsOpen}
                connectWallet={connectWallet}
                currentAccount={currentAccount}
              />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
