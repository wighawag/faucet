export type Env = {
	DEV?: string;
	PROSOPO_SITE_PRIVATE_KEY?: string;
	FAUCET_PRIVATE_KEY?: string;
	// Dynamic env variables: CHAIN_<CHAIN_ID>=<amount>:<rpc_endpoint> for chain config
	[key: `CHAIN_${string}`]: string | undefined;
};
