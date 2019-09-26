import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { StyleSheet, View, WebView } from 'react-native';
import { setSetting } from 'shared-modules/actions/wallet';
import { getThemeFromState } from 'shared-modules/selectors/global';
import { width } from 'libs/dimensions';
import { Styling } from 'ui/theme/general';
import { leaveNavigationBreadcrumb } from 'libs/bugsnag';

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    bottomContainer: {
        flex: 1,
    },
    topContainer: {
        flex: 11,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    titleText: {
        fontFamily: 'SourceSansPro-Regular',
        fontSize: Styling.fontSize3,
        backgroundColor: 'transparent',
        marginLeft: width / 25,
    },
});

const VGSColletFormHTML = `
<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>VGS Collect Credit Card Example</title>
      <script type="text/javascript" src="https://js.verygoodvault.com/vgs-collect/1/vgs-collect-examples.js"></script>
      <style>
        .box {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }
        span[id*="cc-"] iframe {
          height: 100%;
          width: 100%;
        }
        .box div {
          width: 90%;
        }
        html, body {
          height: 100%;
        }
        .form-field {
          display: block;
          width: 100%;
          height: calc(2.25rem + 2px);
          padding: .375rem .75rem;
          font-size: 1rem;
          line-height: 1.5;
          color: #495057;
          background-clip: padding-box;
          border: 1px solid #ced4da;
          border-radius: .25rem;
          transition: border-color .15s ease-in-out,box-shadow .15s ease-in-out;
        }
        .form-field iframe {
          height: 100%;
          vertical-align: middle;
          width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="box-inner">
          <form id="cc-form">
            <section class="form-group">
              <label for="cc-name">Name</label>
              <span id="cc-name" class="form-field">
                <input type="text" />
              </span>
              <br><BR> 
              <button type="submit" class="btn btn-success btn-block">Submit</button>
            </section>
          </form>
          <script>
            const form = VGSCollect.create('tntq4dwvhri', function(state) {});

            form.field('#cc-name', {
              type: 'text',
              name: 'card_number',
              placeholder: '',
              defaultValue: '421211',
              validations: ['required'],
            });

            document.getElementById('cc-form')
            .addEventListener('submit', function(e) {
              e.preventDefault();
              form.submit('/post', {
              }, function(status, data) {
                console.log(data);
                // window.ReactNativeWebView.postMessage("qweqweqweqweqwe", "*");
              });
            }, function (errors) {});
          </script> 
        </div>
      </div>
    </body>
  <html>
`;

/**
 * (MoonPay) Add Payment Method
 */
class AddPaymentMethod extends PureComponent {
    static propTypes = {
        /** @ignore */
        setSetting: PropTypes.func.isRequired,
        /** @ignore */
        theme: PropTypes.object.isRequired,
    };

    componentDidMount() {
        leaveNavigationBreadcrumb('About');
    }

    /**
     * Gets current year
     *
     * @method getYear
     * @returns {number}
     */
    getYear() {
        const date = new Date();
        return date.getFullYear();
    }

    render() {
        return (
            <View style={styles.container}>
                <WebView
                    style={{ flex: 1 }}
                    source={{ html: VGSColletFormHTML }}
                    scrollEnabled={false}
                    javaScriptEnabled
                />
            </View>
        );
    }
}

const mapStateToProps = (state) => ({
    theme: getThemeFromState(state),
});

const mapDispatchToProps = {
    setSetting,
};

export default withTranslation(['global'])(
    connect(
        mapStateToProps,
        mapDispatchToProps,
    )(AddPaymentMethod),
);
