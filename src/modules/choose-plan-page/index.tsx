import { Header } from "../../header";
import { usePaymentPageInteractor } from "./interactor";
import { PaymentPageRouter } from "./router";
import React from "react";

export const PaymentPage: React.FC<{}> = () => {
  const interactor = usePaymentPageInteractor();

  return (
    <PaymentPageRouter
      header={<Header backgroundColor="#FFF" />}
      interactor={interactor}
    />
  );
};
