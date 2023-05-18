export const daiAbi = require("./abi/DAIABI.json");

export const erc20 = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() external view returns (uint8)",
];
export const aTokenAbi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function nonces(address owner) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function name() external view returns (string memory)"
];

export const debtTokenABI = [
    "function approveDelegation(address delegatee, uint256 amount) external",
    "function borrowAllowance(address fromUser, address toUser) external view returns (uint256)"
];
export const WETHGateABI = [
    "function depositETH(address,address onBehalfOf,uint16 referralCode) payable external"
];

export const LIDO_ABI = [
    {
        constant: false,
        inputs: [{ name: "_referral", type: "address" }],
        name: "submit",
        outputs: [{ name: "", type: "uint256" }],
        payable: true,
        stateMutability: "payable",
        type: "function"
    }
];

export const WethABI = [
    "function balanceOf(address) public view returns (uint256)",
    "function deposit() public payable",
    "function approve(address guy, uint wad) public returns (bool)"
];

