import { useRemoteConfig } from "../../providers/remote-config-provider";
import { useUser } from "../../providers/user-provider";
import { API } from "../../services/api";
import { ApiFile } from "../../services/api/types";
import { generatePDFCover } from "../../use-cases/generate-pdf-cover";
import {
  PaymentPlanId,
  useGetSubscriptionProducts,
} from "../../use-cases/get-subscription-products";
import check from "./assets/check.svg";
import cross from "./assets/cross.svg";
import { InternalFileType, PAGE_LINKS } from "./types/choose-pan.enums";
import { IPaymentPageInteractor, Plan } from "./types/choose-plan.interfaces";
import { Bullets } from "./types/choose-plan.types";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

export const imagesFormat = [
  InternalFileType.HEIC,
  InternalFileType.SVG,
  InternalFileType.PNG,
  InternalFileType.BMP,
  InternalFileType.EPS,
  InternalFileType.GIF,
  InternalFileType.TIFF,
  InternalFileType.WEBP,
  InternalFileType.JPG,
  InternalFileType.JPEG,
];

export const usePaymentPageInteractor = (): IPaymentPageInteractor => {
  const router = useRouter();
  const { products } = useGetSubscriptionProducts();
  const { user } = useUser();

  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanId>(
    PaymentPlanId.MONTHLY_FULL
  );
  const [file, setFile] = useState<ApiFile | undefined>();
  const [imagePDF, setImagePDF] = useState<Blob | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [fileLink, setFileLink] = useState<string | null>(null);

  const { abTests, isRemoteConfigLoading } = useRemoteConfig();

  const queryFile = Array.isArray(router.query.file)
    ? router.query.file[0]
    : router.query.file;

  const source: string = Array.isArray(router.query?.source)
    ? router.query?.source[0]
    : router.query?.source;

  const onSelectPlan = (plan: PaymentPlanId) => {
    if (selectedPlan === plan) {
      setSelectedPlan(plan);
      onContinue();

      return;
    }
    setSelectedPlan(plan);
  };

  const onContinue = () => {
    localStorage.setItem("selectedPlan", selectedPlan);

    router.push({ pathname: `${PAGE_LINKS.PAYMENT}`, query: router.query });
  };

  useEffect(() => {
    if (user?.subscription !== null) {
      router.push(PAGE_LINKS.DASHBOARD);
    } else if (!user?.email) {
      router.back();
    } else if (router.query?.token && user?.email === null) {
      const token = Array.isArray(router.query.token)
        ? router.query.token[0]
        : router.query.token;
      API.auth.byEmailToken(token);
    }
  }, [user?.subscription, user?.email, router.query?.token]);

  // @NOTE: analytics on page rendered
  useEffect(() => {
    if (!localStorage.getItem("select_plan_view")) {
      console.log("send event analytic3");
    }

    localStorage.setItem("select_plan_view", "true");

    return () => {
      localStorage.removeItem("select_plan_view");
    };
  }, []);

  useEffect(() => {
    API.files.getFiles().then((res) => {
      if (router.query?.file) {
        const chosenFile = res.files.find(
          (item) => item.id === router.query!.file
        );

        setFile(chosenFile);

        return;
      }
      setFile(res.files[res.files.length - 1]);
    });
  }, []);

  // @NOTE: setting pre-select plan for users from remarketing emails
  useEffect(() => {
    if (router.query?.fromEmail === "true") {
      setSelectedPlan(PaymentPlanId.MONTHLY_FULL_SECOND_EMAIL);
      return;
    }
  }, [abTests]);

  // @NOTE: generating cover for pdf-documents
  const loadPdfCover = async (): Promise<void> => {
    if (!file || file.internal_type !== "PDF") {
      return;
    }

    setIsImageLoading(true);

    try {
      let fileUrl: string;
      if (router.query?.file) {
        fileUrl =
          router.query.editedFile === "true"
            ? (await API.files.editedFile(queryFile)).url
            : (await API.files.downloadFile(queryFile)).url;
      } else {
        fileUrl = (await API.files.downloadFile(file.id)).url;
      }

      const pdfCover = await generatePDFCover({
        pdfFileUrl: fileUrl,
        width: 640,
      });

      setImagePDF(pdfCover);
    } finally {
      setIsImageLoading(false);
    }
  };

  const loadImageCover = async () => {
    if (
      !file ||
      !imagesFormat.includes(file.internal_type) ||
      // @NOTE: this two checks fir filename exists because sometimes OS do not pass file.type correctly
      !imagesFormat.includes(
        file.filename.slice(-3).toUpperCase() as InternalFileType
      ) ||
      !imagesFormat.includes(
        file.filename.slice(-4).toUpperCase() as InternalFileType
      )
    ) {
      return;
    }

    const fileUrl = await (async () => {
      if (router.query?.file) {
        const fetchMethod =
          router.query.editedFile === "true"
            ? API.files.editedFile(queryFile)
            : API.files.downloadFile(queryFile);
        const response = await fetchMethod;
        return response.url;
      }
      const response = await API.files.downloadFile(file.id);
      return response.url;
    })();

    setFileLink(fileUrl);
  };

  useEffect(() => {
    loadPdfCover();
    loadImageCover();
  }, [file, router.query?.file]);

  const getFormattedPrice = (
    price: number,
    currency: string,
    type: string
  ): string => {
    const formattedPrice = price / 100;
    const currencySymbol = getCurrency(currency);
    const pricePerMonth = formattedPrice / 12;

    if (type === "trial") {
      return `${currencySymbol}${formattedPrice.toFixed(2)}`;
    } else if (type === "annual") {
      return `${currencySymbol}${pricePerMonth.toFixed(2)}`;
    }

    return "";
  };

  const getCurrency = (currency: string): string => {
    switch (currency) {
      case "USD":
        return "$";
      case "GBP":
        return "£";
      default:
        return "€";
    }
  };

  const generateBullets = (
    t: (key: string) => string,
    prefix: string,
    positive: boolean
  ): Bullets[] => {
    const bullets: Bullets[] = [];
    for (let i = 1; i <= 8; i++) {
      bullets.push({
        imgSrc: positive ? check : cross,
        bullText: (
          <span className={`${positive ? "" : "text-[#878787]"}`}>
            {t(`payment_page.plans.${prefix}.bullet${i}`)}
          </span>
        ),
      });
    }
    return bullets;
  };

  const getPlans = (t: (key: string, options?: any) => string): Plan[] => {
    function handlePeriod(index) {
      switch (index) {
        case 0:
          return "monthly";
        case 1:
          return "monthly_full";
        case 2:
          return "annual";
        default:
          return "monthly";
      }
    }
    return products?.map(({ name, price }, index) => {
      return {
        id: name,
        title: t(`payment_page.plans.${handlePeriod(index)}.title`),
        price: getFormattedPrice(
          index === 2 ? price?.price : price?.trial_price,
          price?.currency,
          index === 2 ? "annual" : "trial"
        ),
        fullPrice: getFormattedPrice(price?.price, price.currency, "trial"),
        formattedCurrency: getCurrency(price?.currency),
        date: index === 2 ? t("payment_page.plans.annual.date") : null,
        bullets: generateBullets(t, handlePeriod(index), true),
        text: t(`payment_page.plans.${handlePeriod(index)}.text`, {
          formattedPrice: getFormattedPrice(
            products[0]?.price?.price,
            products[0]?.price?.currency,
            "trial"
          ),
        }),
      };
    });
  };

  return {
    selectedPlan,
    onSelectPlan,
    onContinue,

    imagePDF: imagePDF ?? null,
    isImageLoading,
    fileName: file?.filename ?? null,
    fileType: file?.internal_type ?? null,
    fileLink,
    isEditorFlow:
      ["editor", "account"].includes(source) &&
      router.query.convertedFrom === undefined,
    isSecondEmail: router.query?.fromEmail === "true",
    isThirdEmail: router.query?.fromEmail === "true",

    isRemoteConfigLoading,

    getPlans,
    isPlansLoading: products.length === 0,
  };
};
