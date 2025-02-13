import { Flex, HStack } from '@chakra-ui/layout'
import { Button, Skeleton, SkeletonCircle, Stack } from '@chakra-ui/react'
import { Tag } from '@chakra-ui/tag'
import { caip19 } from '@shapeshiftoss/caip'
import { SupportedYearnVault, YearnVault } from '@shapeshiftoss/investor-yearn'
import { ContractTypes, NetworkTypes } from '@shapeshiftoss/types'
import { useYearn } from 'features/defi/contexts/YearnProvider/YearnProvider'
import qs from 'qs'
import { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { Amount } from 'components/Amount/Amount'
import { AssetIcon } from 'components/AssetIcon'
import { RawText, Text } from 'components/Text'
import { useChainAdapters } from 'context/ChainAdaptersProvider/ChainAdaptersProvider'
import { useWallet, WalletActions } from 'context/WalletProvider/WalletProvider'
import { BigNumber, bnOrZero } from 'lib/bignumber/bignumber'
import { selectAssetByCAIP19, selectMarketDataById } from 'state/slices/selectors'
import { useAppSelector } from 'state/store'

export const EarnOpportunityRow = ({
  type,
  provider,
  vaultAddress,
  tokenAddress,
  chain,
  symbol,
  name,
  isLoaded
}: SupportedYearnVault & { isLoaded: boolean }) => {
  const [vault, setVault] = useState<YearnVault | null>(null)
  const [cryptoAmount, setCryptoAmount] = useState<BigNumber>(bnOrZero(0))
  const [fiatAmount, setFiatAmount] = useState<BigNumber>(bnOrZero(0))
  const { yearn, loading } = useYearn()
  const history = useHistory()
  const location = useLocation()

  const network = NetworkTypes.MAINNET
  const contractType = ContractTypes.ERC20
  // asset
  const assetCAIP19 = caip19.toCAIP19({ chain, network, contractType, tokenId: tokenAddress })
  const asset = useAppSelector(state => selectAssetByCAIP19(state, assetCAIP19))
  const marketData = useAppSelector(state => selectMarketDataById(state, assetCAIP19))

  // account info
  const chainAdapterManager = useChainAdapters()
  const chainAdapter = chainAdapterManager.byChain(chain)
  const {
    state: { isConnected, wallet },
    dispatch
  } = useWallet()

  const handleClick = () => {
    isConnected
      ? history.push({
          pathname: `/defi/${type}/${provider}/deposit`,
          search: qs.stringify({
            chain,
            contractAddress: vaultAddress,
            tokenId: tokenAddress
          }),
          state: { background: location }
        })
      : dispatch({ type: WalletActions.SET_WALLET_MODAL, payload: true })
  }

  useEffect(() => {
    ;(async () => {
      if (!yearn || !wallet || loading) return null
      try {
        const _vault = yearn.findByVaultTokenId(vaultAddress)
        if (_vault) setVault(_vault)
        const userAddress = await chainAdapter.getAddress({ wallet })
        // TODO: currently this is hard coded to yearn vaults only.
        // In the future we should add a hook to get the provider interface by vault provider
        const [balance, pricePerShare] = await Promise.all([
          yearn.balance({ vaultAddress, userAddress }),
          yearn.pricePerShare({ vaultAddress })
        ])
        const amount = bnOrZero(balance).div(`1e+${vault?.decimals}`)
        const price = pricePerShare.div(`1e+${vault?.decimals}`).times(marketData?.price)
        setCryptoAmount(amount)
        setFiatAmount(amount.times(price))
      } catch (error) {
        console.error('StakingVaultRow useEffect', error)
      }
    })()
  }, [
    chainAdapter,
    loading,
    marketData?.price,
    tokenAddress,
    vault?.decimals,
    vaultAddress,
    wallet,
    yearn
  ])

  const hasZeroBalanceAndApy =
    bnOrZero(vault?.metadata?.apy?.net_apy).isEqualTo(0) && bnOrZero(cryptoAmount).isEqualTo(0)

  if (!asset || !vault || hasZeroBalanceAndApy || !yearn || loading) return null

  return (
    <Button
      width='full'
      height='auto'
      justifyContent='space-between'
      variant='ghost'
      fontWeight='normal'
      py={2}
      onClick={handleClick}
    >
      <Flex alignItems='center'>
        <Flex mr={4}>
          <SkeletonCircle boxSize='8' isLoaded={isLoaded}>
            <AssetIcon src={asset?.icon} boxSize='8' />
          </SkeletonCircle>
        </Flex>
        <Stack
          direction={{ base: 'column', lg: 'row' }}
          alignItems={{ base: 'flex-start', lg: 'center' }}
          justifyContent='flex-start'
          spacing={{ base: 1, lg: 4 }}
        >
          <Skeleton isLoaded={isLoaded} display='flex'>
            <RawText
              size='lg'
              fontWeight='bold'
              textOverflow='ellipsis'
              whiteSpace='nowrap'
              overflow='hidden'
              display='inline-block'
              maxWidth={{ base: '200px', lg: '100%' }}
            >
              {name}
            </RawText>
          </Skeleton>
          <Skeleton isLoaded={isLoaded}>
            <Tag colorScheme='green'>
              <Amount.Percent value={bnOrZero(vault?.metadata?.apy?.net_apy).toString()} />
            </Tag>
          </Skeleton>
        </Stack>
      </Flex>
      <Flex>
        <Skeleton isLoaded={isLoaded}>
          {cryptoAmount.gt(0) ? (
            <HStack>
              <Amount.Fiat value={fiatAmount.toString()} color='green.500' />
              <Amount.Crypto value={cryptoAmount.toString()} symbol={symbol} prefix='≈' />
            </HStack>
          ) : (
            <Button as='span' colorScheme='blue' variant='ghost-filled' size='sm'>
              <Text translation='common.getStarted' />
            </Button>
          )}
        </Skeleton>
      </Flex>
    </Button>
  )
}
