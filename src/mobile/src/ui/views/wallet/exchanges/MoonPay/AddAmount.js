import head from 'lodash/head';
import includes from 'lodash/includes';
import map from 'lodash/map';
import toUpper from 'lodash/toUpper';
import toLower from 'lodash/toLower';
import size from 'lodash/size';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { StyleSheet, View, Text } from 'react-native';
import { connect } from 'react-redux';
import { getThemeFromState } from 'shared-modules/selectors/global';
import { getFiatCurrencies } from 'shared-modules/selectors/exchanges/MoonPay';
import { fetchQuote, setAmount, setDenomination } from 'shared-modules/actions/exchanges/MoonPay';
import DualFooterButtons from 'ui/components/DualFooterButtons';
import CustomTextInput from 'ui/components/CustomTextInput';
import navigator from 'libs/navigation';
import InfoBox from 'ui/components/InfoBox';
import { width, height } from 'libs/dimensions';
import { Styling } from 'ui/theme/general';
import Header from 'ui/components/Header';
import AnimatedComponent from 'ui/components/AnimatedComponent';

const styles = StyleSheet.create({
    animation: {
        width: width / 2.4,
        height: width / 2.4,
        alignSelf: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topContainer: {
        flex: 0.7,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    midContainer: {
        flex: 3.3,
        alignItems: 'center',
    },
    bottomContainer: {
        flex: 0.5,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    infoText: {
        fontFamily: 'SourceSansPro-Light',
        fontSize: Styling.fontSize6,
        textAlign: 'center',
        backgroundColor: 'transparent',
    },
    infoTextLight: {
        fontFamily: 'SourceSansPro-Light',
        fontSize: Styling.fontSize3,
        backgroundColor: 'transparent',
    },
    infoTextRegular: {
        fontFamily: 'SourceSansPro-Regular',
        fontSize: Styling.fontSize3,
        backgroundColor: 'transparent',
    },
    infoTextBold: {
        fontFamily: 'SourceSansPro-Bold',
        fontSize: Styling.fontSize4,
        backgroundColor: 'transparent',
    },
    greetingTextContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: width / 1.5,
    },
    greetingText: {
        fontFamily: 'SourceSansPro-Light',
        fontSize: Styling.fontSize4,
        textAlign: 'center',
        backgroundColor: 'transparent',
    },
});

/** MoonPay add amount screen component */
class AddAmount extends Component {
    static propTypes = {
        /** @ignore */
        t: PropTypes.func.isRequired,
        /** @ignore */
        theme: PropTypes.object.isRequired,
        /** @ignore */
        amount: PropTypes.string.isRequired,
        /** @ignore */
        denomination: PropTypes.string.isRequired,
        /** @ignore */
        fiatCurrencies: PropTypes.array.isRequired,
        /** @ignore */
        exchangeRates: PropTypes.object.isRequired,
        /** @ignore */
        fetchQuote: PropTypes.func.isRequired,
        /** @ignore */
        setAmount: PropTypes.func.isRequired,
        /** @ignore */
        setDenomination: PropTypes.func.isRequired,
    };

    /**
     * Navigates to chosen screen
     *
     * @method redirectToScreen
     */
    static redirectToScreen(screen) {
        navigator.push(screen);
    }

    static iotaDenominations = ['i', 'Ki', 'Mi', 'Gi', 'Ti'];

    /**
     * Sets next denomination in redux store
     *
     * @method setDenomination
     *
     * @returns {void}
     */
    setDenomination() {
        const { denomination, fiatCurrencies } = this.props;

        const availableDenominations = [
            ...AddAmount.iotaDenominations,
            ...map(fiatCurrencies, (currency) => toUpper(currency.code)),
        ];

        const currentDenominationIndex = availableDenominations.indexOf(denomination);

        const nextDenomination =
            currentDenominationIndex === -1 || currentDenominationIndex === size(availableDenominations) - 1
                ? head(availableDenominations)
                : availableDenominations[currentDenominationIndex + 1];

        this.props.setDenomination(nextDenomination);
    }

    render() {
        const { amount, t, theme, denomination } = this.props;
        const textColor = { color: theme.body.color };

        return (
            <View style={[styles.container, { backgroundColor: theme.body.bg }]}>
                <View style={styles.topContainer}>
                    <AnimatedComponent
                        animationInType={['slideInRight', 'fadeIn']}
                        animationOutType={['slideOutLeft', 'fadeOut']}
                        delay={400}
                    >
                        <Header textColor={theme.body.color} />
                    </AnimatedComponent>
                </View>
                <View style={styles.midContainer}>
                    <View style={{ flex: 0.2 }} />
                    <AnimatedComponent
                        animationInType={['slideInRight', 'fadeIn']}
                        animationOutType={['slideOutLeft', 'fadeOut']}
                        delay={266}
                    >
                        <InfoBox>
                            <Text style={[styles.infoText, textColor]}>{t('moonpay:addAmount')}</Text>
                            <Text style={[styles.infoTextRegular, textColor, { paddingTop: height / 60 }]}>
                                {t('moonpay:addAmountExplanation')}
                            </Text>
                        </InfoBox>
                    </AnimatedComponent>
                    <View style={{ flex: 0.3 }} />
                    <AnimatedComponent
                        animationInType={['slideInRight', 'fadeIn']}
                        animationOutType={['slideOutLeft', 'fadeOut']}
                        delay={200}
                    >
                        <CustomTextInput
                            keyboardType="numeric"
                            label={t('moonpay:enterAmount')}
                            onRef={(c) => {
                                this.amountField = c;
                            }}
                            onValidTextChange={(amount) => {
                                this.props.setAmount(amount);

                                // TODO: Do validation on amount
                                this.props.fetchQuote(
                                    Number(amount),
                                    includes(AddAmount.iotaDenominations, denomination)
                                        ? denomination
                                        : toLower(denomination),
                                );
                            }}
                            autoCorrect={false}
                            enablesReturnKeyAutomatically
                            widgets={['denomination']}
                            theme={theme}
                            denominationText={denomination}
                            onDenominationPress={() => {
                                this.setDenomination();
                            }}
                            value={amount}
                        />
                    </AnimatedComponent>
                    <View style={{ flex: 0.3 }} />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            width: width / 1.2,
                        }}
                    >
                        <Text style={[styles.infoTextLight, textColor]}>You will receive</Text>
                        <Text style={[styles.infoTextLight, textColor]}>82.12 Miota</Text>
                    </View>
                    <View style={{ flex: 0.05 }} />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            width: width / 1.2,
                        }}
                    >
                        <Text style={[styles.infoTextLight, textColor]}>Market Price: 82.13 Mi @ $0.12</Text>
                        <Text style={[styles.infoTextLight, textColor]}>$0.12</Text>
                    </View>
                    <View style={{ flex: 0.05 }} />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            width: width / 1.2,
                        }}
                    >
                        <Text style={[styles.infoTextLight, textColor]}>MoonPay Fee</Text>
                        <Text style={[styles.infoTextLight, textColor]}>$4.99</Text>
                    </View>
                    <View style={{ flex: 0.3 }} />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            width: width / 1.2,
                        }}
                    >
                        <Text style={[styles.infoTextRegular, textColor]}>Total</Text>
                        <Text style={[styles.infoTextBold, textColor]}>$42.00</Text>
                    </View>
                    <View style={{ flex: 0.3 }} />
                </View>
                <View style={styles.bottomContainer}>
                    <AnimatedComponent animationInType={['fadeIn']} animationOutType={['fadeOut']}>
                        <DualFooterButtons
                            onLeftButtonPress={() => AddAmount.redirectToScreen('landing')}
                            onRightButtonPress={() => AddAmount.redirectToScreen('selectAccount')}
                            leftButtonText={t('global:goBack')}
                            rightButtonText={t('global:purchase')}
                            leftButtonTestID="walletSetup-no"
                            rightButtonTestID="walletSetup-yes"
                        />
                    </AnimatedComponent>
                </View>
            </View>
        );
    }
}

const mapStateToProps = (state) => ({
    theme: getThemeFromState(state),
    themeName: state.settings.themeName,
    amount: state.exchanges.moonpay.amount,
    denomination: state.exchanges.moonpay.denomination,
    fiatCurrencies: getFiatCurrencies(state),
    exchangeRates: state.exchanges.moonpay.exchangeRates,
});

const mapDispatchToProps = {
    fetchQuote,
    setAmount,
    setDenomination,
};

export default withTranslation()(
    connect(
        mapStateToProps,
        mapDispatchToProps,
    )(AddAmount),
);
