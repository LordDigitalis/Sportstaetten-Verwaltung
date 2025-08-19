import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useParams } from 'react-router-dom';
import CheckoutForm from './CheckoutForm';
import { useTranslation } from 'react-i18next';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Payment = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams();

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm sessionId={sessionId} />
    </Elements>
  );
};

export default Payment;